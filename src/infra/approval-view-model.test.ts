import { describe, expect, it } from "vitest";
import { buildExpiredApprovalView, buildPendingApprovalView } from "./approval-view-model.js";
import type { ExecApprovalRequest } from "./exec-approvals.js";
import type { PluginApprovalRequest } from "./plugin-approvals.js";

describe("buildPendingApprovalView", () => {
  it("passes command analysis through exec approval views", () => {
    const request: ExecApprovalRequest = {
      id: "approval-id",
      createdAtMs: 1,
      expiresAtMs: 2,
      request: {
        command: 'ls | grep "stuff" | python -c \'print("hi")\'',
        host: "node",
        ask: "always",
        commandAnalysis: {
          commandCount: 1,
          nestedCommandCount: 0,
          riskKinds: ["inline-eval"],
          warningLines: ["Contains inline-eval: python -c"],
        },
      },
    };

    const view = buildPendingApprovalView(request);

    expect(view.approvalKind).toBe("exec");
    if (view.approvalKind !== "exec") {
      throw new Error("expected exec approval view");
    }
    expect(view.commandAnalysis?.warningLines).toEqual(["Contains inline-eval: python -c"]);
    expect(view.actions.map((action) => action.decision)).toEqual(["allow-once", "deny"]);
  });

  it("builds plugin approval actions from explicit allowed decisions", () => {
    const request: PluginApprovalRequest = {
      id: "plugin:approval-id",
      createdAtMs: 1,
      expiresAtMs: 2,
      request: {
        title: "Plugin approval",
        description: "Approve a plugin action",
        severity: "critical",
        allowedDecisions: ["deny"],
      },
    };

    const view = buildPendingApprovalView(request);

    expect(view.approvalKind).toBe("plugin");
    expect(view.metadata).toContainEqual({ label: "Severity", value: "Critical" });
    expect(view.actions).toEqual([
      {
        decision: "deny",
        label: "Deny",
        style: "danger",
        command: "/approve plugin:approval-id deny",
      },
    ]);
  });

  it("preserves escaped command display in expired exec views", () => {
    const request: ExecApprovalRequest = {
      id: "approval-id",
      createdAtMs: 1,
      expiresAtMs: 2,
      request: {
        command: "echo safe\u200btext",
      },
    };

    const view = buildExpiredApprovalView(request);

    expect(view.approvalKind).toBe("exec");
    if (view.approvalKind !== "exec") {
      throw new Error("expected exec approval view");
    }
    expect(view.commandText).toBe("echo safe\\u{200B}text");
  });
});
