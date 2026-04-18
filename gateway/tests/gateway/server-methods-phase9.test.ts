import { describe, it, expect } from "vitest";
import { coreGatewayHandlers } from "../../src/gateway/server-methods.js";
import { authorizeOperatorScopesForMethod, ADMIN_SCOPE, READ_SCOPE } from "../../src/gateway/method-scopes.js";
import { ExecApprovalManager } from "../../src/gateway/exec-approval-manager.js";
import { listGatewayMethods } from "../../src/gateway/server-methods-list.js";
import { diffConfigPaths, buildGatewayReloadPlan } from "../../src/gateway/config-reload.js";

describe("Phase 9: Deep Gateway Infrastructure", () => {
    it("should export methods matching Phase 9 CoreBlow parity", () => {
        expect(coreGatewayHandlers["exec.approval.request"]).toBeDefined();
        expect(coreGatewayHandlers["exec.approvals.get"]).toBeDefined();
        expect(coreGatewayHandlers["plugin.approval.request"]).toBeDefined();
        expect(coreGatewayHandlers["secrets.reload"]).toBeDefined();
        expect(coreGatewayHandlers["tools.catalog"]).toBeDefined();
        expect(coreGatewayHandlers["tools.effective"]).toBeDefined();
    });

    it("should classify methods correctly with method-scopes", () => {
        const adminCheck = authorizeOperatorScopesForMethod("agents.create", [ADMIN_SCOPE]);
        expect(adminCheck.allowed).toBe(true);

        const readCheck = authorizeOperatorScopesForMethod("logs.tail", [READ_SCOPE]);
        expect(readCheck.allowed).toBe(true);

        const failCheck = authorizeOperatorScopesForMethod("agents.create", [READ_SCOPE]);
        expect(failCheck.allowed).toBe(false);
    });

    it("should manage exec approvals correctly using ExecApprovalManager", async () => {
        const mgr = new ExecApprovalManager();
        const record = mgr.create({ command: "ls" }, 100);

        // Wait for decision
        const p = mgr.register(record, 100);
        mgr.resolve(record.id, "allow-once");
        const decision = await p;

        expect(decision).toBe("allow-once");
    });

    it("should correctly calculate config reload plans", () => {
        const prev = { gateway: { port: 3000 } };
        const next = { gateway: { port: 3001 } };
        const diff = diffConfigPaths(prev, next);
        expect(diff).toContain("gateway.port");

        const plan = buildGatewayReloadPlan(diff);
        expect(plan.restartGateway).toBe(true);
        expect(plan.restartReasons).toContain("gateway.port");
    });

    it("should export complete gateway methods list", () => {
        const list = listGatewayMethods();
        expect(list.length).toBeGreaterThan(60);
        expect(list).toContain("exec.approval.request");
        expect(list).toContain("chat.history");
    });
});
