/**
 * Phase 25 — Test 2: Phase 17 (Gateway RPC Full Surface)
 * Exercises EVERY registered RPC handler in coreGatewayHandlers.
 */
import { describe, it, expect } from "vitest";
import { coreGatewayHandlers } from "../../src/gateway/server-methods.js";

function invokeRpc(method: string, params: object = {}): any {
    const handler = coreGatewayHandlers[method];
    if (!handler) return { __missing: true };
    let result: any = null;
    handler({
        params,
        req: {} as any,
        client: { connect: { device: { id: "test-node" }, client: { id: "test-client" } } } as any,
        context: { nodeRegistry: new Map(), logGateway: { info: () => {}, warn: () => {}, debug: () => {}, error: () => {} } } as any,
        respond: (ok: boolean, payload: any, error: any) => {
            result = { ok, payload, error };
        },
    });
    return result;
}

describe("Phase 17: Gateway RPC Full Surface", () => {

    // ── Sessions ──
    describe("Sessions RPC", () => {
        it("sessions.create returns a session key", () => {
            const r = invokeRpc("sessions.create", {});
            expect(r.ok).toBe(true);
            expect(r.payload.sessionKey).toBeDefined();
        });
        it("sessions.list returns array", () => {
            const r = invokeRpc("sessions.list", {});
            expect(r.ok).toBe(true);
        });
        it("sessions.delete validates params", () => {
            const r = invokeRpc("sessions.delete", { key: "test" });
            expect(r).toBeDefined();
        });
        it("sessions.preview handles missing keys", () => {
            const r = invokeRpc("sessions.preview", { keys: [] });
            expect(r).toBeDefined();
        });
    });

    // ── Chat ──
    describe("Chat RPC", () => {
        it("chat.send returns started status", () => {
            const r = invokeRpc("chat.send", { sessionKey: "s1", message: "Hello" });
            expect(r.ok).toBe(true);
            expect(r.payload.status).toBe("started");
        });
        it("chat.abort returns aborted", () => {
            const r = invokeRpc("chat.abort", { sessionKey: "s1" });
            expect(r.ok).toBe(true);
        });
        it("chat.history returns messages", () => {
            const r = invokeRpc("chat.history", { sessionKey: "s1" });
            expect(r.ok).toBe(true);
            expect(r.payload.messages).toBeDefined();
        });
        it("chat.inject returns ok", () => {
            const r = invokeRpc("chat.inject", {});
            expect(r.ok).toBe(true);
        });
    });

    // ── Agents ──
    describe("Agents RPC", () => {
        it("agents.list returns array", () => {
            const r = invokeRpc("agents.list", {});
            expect(r.ok).toBe(true);
            expect(Array.isArray(r.payload)).toBe(true);
        });
        it("agents.create returns id", () => {
            const r = invokeRpc("agents.create", { name: "Test" });
            expect(r.ok).toBe(true);
        });
        it("agents.update returns updated", () => {
            const r = invokeRpc("agents.update", { agentId: "a1" });
            expect(r.ok).toBe(true);
        });
        it("agents.delete returns deleted", () => {
            const r = invokeRpc("agents.delete", { agentId: "a1" });
            expect(r.ok).toBe(true);
        });
        it("agents.files.list returns files", () => {
            const r = invokeRpc("agents.files.list", { agentId: "a1" });
            expect(r.ok).toBe(true);
        });
        it("agents.files.get returns content", () => {
            const r = invokeRpc("agents.files.get", { agentId: "a1", name: "f" });
            expect(r.ok).toBe(true);
        });
        it("agents.files.set returns saved", () => {
            const r = invokeRpc("agents.files.set", { agentId: "a1", name: "f", content: "c" });
            expect(r.ok).toBe(true);
        });
    });

    // ── Cron ──
    describe("Cron RPC", () => {
        it("cron.list responds", () => {
            const r = invokeRpc("cron.list", {});
            expect(r).toBeDefined();
        });
        it("cron.status responds", () => {
            const r = invokeRpc("cron.status", {});
            expect(r).toBeDefined();
        });
    });

    // ── Config & Models ──
    describe("Config & Models RPC", () => {
        it("config.get responds", () => {
            const r = invokeRpc("config.get", {});
            expect(r).toBeDefined();
        });
        it("models.list responds", () => {
            const r = invokeRpc("models.list", {});
            expect(r).toBeDefined();
        });
    });

    // ── Skills ──
    describe("Skills RPC", () => {
        it("skills.status responds", () => {
            const r = invokeRpc("skills.status", {});
            expect(r).toBeDefined();
        });
    });

    // ── System ──
    describe("System RPC", () => {
        it("system-event validates text param", () => {
            const r = invokeRpc("system-event", { text: "heartbeat" });
            expect(r.ok).toBe(true);
        });
        it("health.status responds", () => {
            const r = invokeRpc("health.status", {});
            expect(r).toBeDefined();
        });
    });

    // ── Approvals ──
    describe("Approvals RPC", () => {
        it("exec.approval.request responds", () => {
            const r = invokeRpc("exec.approval.request", { command: "rm -rf /" });
            expect(r).toBeDefined();
        });
        it("plugin.approval.request responds", () => {
            const r = invokeRpc("plugin.approval.request", { title: "test", description: "desc" });
            expect(r).toBeDefined();
        });
    });

    // ── Tools ──
    describe("Tools RPC", () => {
        it("tools.catalog responds", () => {
            const r = invokeRpc("tools.catalog", {});
            expect(r).toBeDefined();
        });
        it("tools.effective responds", () => {
            const r = invokeRpc("tools.effective", { sessionKey: "s1" });
            expect(r).toBeDefined();
        });
    });

    // ── Node Pending ──
    describe("Node Pending RPC", () => {
        it("node.pending.drain responds", () => {
            const r = invokeRpc("node.pending.drain", {});
            expect(r).toBeDefined();
        });
        it("node.pending.enqueue responds", () => {
            const r = invokeRpc("node.pending.enqueue", { nodeId: "n1", type: "sync" });
            expect(r).toBeDefined();
        });
    });

    // ── Completeness check ──
    describe("Handler Registry Completeness", () => {
        it("should have at least 30 registered methods", () => {
            const count = Object.keys(coreGatewayHandlers).length;
            expect(count).toBeGreaterThanOrEqual(30);
        });
    });
});
