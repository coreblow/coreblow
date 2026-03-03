/**
 * flows/contributions.ts
 *
 * Flow contribution framework for injecting dynamic steps or data
 * into flows from plugins or different system modules.
 */

export interface FlowContribution {
    id: string;
    flowId: string;
    priority: number;
    injectBefore?: string;
    injectAfter?: string;
    content: unknown; // Can be a step definition or dynamic data
}

export class ContributionRegistry {
    private contributions: FlowContribution[] = [];

    register(contribution: FlowContribution): void {
        this.contributions.push(contribution);
        this.sort();
    }

    unregister(id: string): boolean {
        const initialLength = this.contributions.length;
        this.contributions = this.contributions.filter(c => c.id !== id);
        return this.contributions.length !== initialLength;
    }

    getForFlow(flowId: string): FlowContribution[] {
         return this.contributions.filter(c => c.flowId === flowId);
    }

    // Merge contributions into a list of items using injectBefore/injectAfter logic.
    merge<T extends { id: string }>(baseItems: T[], extract: (c: FlowContribution) => T): T[] {
        const result = [...baseItems];
        for (const c of this.contributions) {
           const item = extract(c);
           if (c.injectBefore) {
               const idx = result.findIndex(r => r.id === c.injectBefore);
               if (idx !== -1) {
                   result.splice(idx, 0, item);
                   continue;
               }
           }
           if (c.injectAfter) {
               const idx = result.findIndex(r => r.id === c.injectAfter);
               if (idx !== -1) {
                   result.splice(idx + 1, 0, item);
                   continue;
               }
           }
           // Default: push to end
           result.push(item);
        }
        return result;
    }

    private sort(): void {
        this.contributions.sort((a, b) => a.priority - b.priority);
    }

    clear(): void {
        this.contributions = [];
    }
}
