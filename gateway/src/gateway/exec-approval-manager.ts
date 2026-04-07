import { randomUUID } from "node:crypto";

export type ExecApprovalDecision = "allow-once" | "allow-always" | "deny";

export interface ExecApprovalSnapshot<TRequest = any> {
    id: string;
    request: TRequest;
    decision: ExecApprovalDecision | null;
    createdAtMs: number;
    expiresAtMs: number;
    resolvedAtMs?: number;
    resolvedBy?: string | null;
    requestedByConnId?: string | null;
    requestedByDeviceId?: string | null;
    requestedByClientId?: string | null;
}

export class ExecApprovalManager<TRequest = any> {
    private pending = new Map<string, {
        snapshot: ExecApprovalSnapshot<TRequest>;
        resolveDecision: (decision: ExecApprovalDecision | null) => void;
        timer: NodeJS.Timeout;
    }>();

    create(request: TRequest, timeoutMs: number, explicitId: string | null = null): ExecApprovalSnapshot<TRequest> {
        const id = explicitId || randomUUID();
        const now = Date.now();
        return {
            id,
            request,
            decision: null,
            createdAtMs: now,
            expiresAtMs: now + timeoutMs,
        };
    }

    async register(snapshot: ExecApprovalSnapshot<TRequest>, timeoutMs: number): Promise<ExecApprovalDecision | null> {
        if (this.pending.has(snapshot.id)) {
            throw new Error(`Approval ${snapshot.id} already pending`);
        }
        
        return new Promise<ExecApprovalDecision | null>((resolve) => {
            const timer = setTimeout(() => {
                this.expire(snapshot.id, "timeout");
            }, timeoutMs);
            timer.unref?.();

            this.pending.set(snapshot.id, {
                snapshot,
                resolveDecision: resolve,
                timer
            });
        });
    }

    resolve(id: string, decision: ExecApprovalDecision, resolvedBy: string | null = null): boolean {
        const entry = this.pending.get(id);
        if (!entry) return false;

        const { snapshot, resolveDecision, timer } = entry;
        clearTimeout(timer);
        this.pending.delete(id);

        snapshot.decision = decision;
        snapshot.resolvedAtMs = Date.now();
        snapshot.resolvedBy = resolvedBy;

        resolveDecision(decision);
        return true;
    }

    expire(id: string, reason: string): boolean {
        const entry = this.pending.get(id);
        if (!entry) return false;

        const { resolveDecision, timer } = entry;
        clearTimeout(timer);
        this.pending.delete(id);
        resolveDecision(null);
        return true;
    }

    getSnapshot(id: string): ExecApprovalSnapshot<TRequest> | undefined {
        return this.pending.get(id)?.snapshot;
    }

    lookupPendingId(prefix: string): { kind: "none" } | { kind: "exact"; id: string } | { kind: "ambiguous"; ids: string[] } {
        const matches: string[] = [];
        for (const id of this.pending.keys()) {
            if (id === prefix) {
                return { kind: "exact", id };
            }
            if (id.startsWith(prefix)) {
                matches.push(id);
            }
        }
        if (matches.length === 0) return { kind: "none" };
        if (matches.length === 1) return { kind: "exact", id: matches[0] };
        return { kind: "ambiguous", ids: matches };
    }

    awaitDecision(id: string): Promise<ExecApprovalDecision | null> | null {
        const entry = this.pending.get(id);
        if (!entry) return null;
        return new Promise((resolve) => {
            // Intercept without replacing the main promise
            const originalResolve = entry.resolveDecision;
            entry.resolveDecision = (decision) => {
                resolve(decision);
                originalResolve(decision);
            };
        });
    }
}
