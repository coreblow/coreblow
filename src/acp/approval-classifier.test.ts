import { describe, expect, it } from "vitest";
import { classifyAcpToolApproval } from "./approval-classifier.js";

describe("classifyAcpToolApproval", () => {
  it("auto-approves trusted reads only inside the working directory", () => {
    expect(
      classifyAcpToolApproval({
        cwd: "/workspace",
        toolCall: { title: "read: src/index.ts", rawInput: { path: "src/index.ts" } },
      }),
    ).toMatchObject({ approvalClass: "readonly_scoped", autoApprove: true });
    expect(
      classifyAcpToolApproval({
        cwd: "/workspace",
        toolCall: { title: "read: /etc/passwd", rawInput: { path: "/etc/passwd" } },
      }),
    ).toMatchObject({ approvalClass: "other", autoApprove: false });
  });

  it("never auto-approves execution tools", () => {
    expect(
      classifyAcpToolApproval({ cwd: "/workspace", toolCall: { title: "exec: pwd" } }),
    ).toMatchObject({ toolName: "exec", approvalClass: "exec_capable", autoApprove: false });
  });
});
