import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "typebox";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertExecuteCodeSandboxEligible,
  CODE_EXECUTION_MAX_SPILL_BYTES,
  CODE_EXECUTION_MAX_STDOUT_BYTES,
  createExecuteCodeTool,
  createScopedCodeExecutionRpcHandler,
  truncateHeadTailBytes,
  writeSandboxSpillFile,
} from "./index.js";

function makeDummyTool(name: string): AgentTool {
  return {
    name,
    label: name,
    description: name,
    parameters: Type.Object({}),
    execute: async () => ({
      content: [{ type: "text", text: `${name}:ok` }],
      details: { ok: true },
    }),
  };
}

describe("sandboxed programmatic execute_code tool", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
    }
  });

  it("fails closed when unsandboxed unless explicitly authorized via approvals", () => {
    expect(() =>
      assertExecuteCodeSandboxEligible({ sandboxEnabled: false }),
    ).toThrow("fail-closed");

    expect(() =>
      assertExecuteCodeSandboxEligible({ sandboxEnabled: true, backend: "host" }),
    ).toThrow("fail-closed");

    expect(() =>
      assertExecuteCodeSandboxEligible({
        sandboxEnabled: true,
        backend: "docker",
        dockerReadOnly: false,
      }),
    ).toThrow("docker --read-only");

    expect(() =>
      assertExecuteCodeSandboxEligible({
        sandboxEnabled: true,
        backend: "docker",
        dockerReadOnly: true,
      }),
    ).not.toThrow();

    expect(() =>
      assertExecuteCodeSandboxEligible({
        sandboxEnabled: false,
        explicitlyAuthorizedViaApprovals: true,
      }),
    ).not.toThrow();
  });

  it("rejects disallowed RPC tools and enforces maxToolCalls cap", async () => {
    const rpc = createScopedCodeExecutionRpcHandler({
      tools: [
        makeDummyTool("read"),
        makeDummyTool("gateway"),
        makeDummyTool("nodes"),
        makeDummyTool("sessions_spawn"),
      ],
      maxToolCalls: 2,
    });

    await expect(rpc.invoke("gateway", {})).rejects.toThrow("disallowed");
    await expect(rpc.invoke("nodes", {})).rejects.toThrow("disallowed");
    await expect(rpc.invoke("sessions_spawn", {})).rejects.toThrow("disallowed");

    await rpc.invoke("read", {});
    await rpc.invoke("read", {});
    await expect(rpc.invoke("read", {})).rejects.toThrow("exceeded maxToolCalls (2)");
  });

  it("truncates stdout at 50KB (40% head / 60% tail) and writes spill only inside sandboxSpillDir (<=5MB)", async () => {
    const huge = `${"H".repeat(30_000)}${"M".repeat(40_000)}${"T".repeat(30_000)}`;
    const truncated = truncateHeadTailBytes(huge, CODE_EXECUTION_MAX_STDOUT_BYTES);
    expect(truncated.truncated).toBe(true);
    expect(truncated.bytesCaptured).toBe(CODE_EXECUTION_MAX_STDOUT_BYTES);
    expect(truncated.text.startsWith("H")).toBe(true);
    expect(truncated.text.endsWith("T")).toBe(true);

    // No sandboxSpillDir -> never writes to host
    expect(writeSandboxSpillFile({ text: huge })).toBeUndefined();

    const spillDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-sandbox-spill-"));
    tempDirs.push(spillDir);
    const oversized = "X".repeat(CODE_EXECUTION_MAX_SPILL_BYTES + 1024);
    const spillFile = writeSandboxSpillFile({ text: oversized, sandboxSpillDir: spillDir });
    expect(spillFile).toBeTruthy();
    expect(fs.statSync(spillFile!).size).toBe(CODE_EXECUTION_MAX_SPILL_BYTES);

    const tool = createExecuteCodeTool({
      getSessionTools: () => [makeDummyTool("read")],
      sandbox: { sandboxEnabled: true, backend: "corebox" },
      sandboxSpillDir: spillDir,
      runner: async () => ({ stdout: huge, stderr: "", exitCode: 0 }),
    });
    const res = await tool.execute("run-1", { code: "print('hi')" });
    const details = res.details as { stdoutTruncated: boolean; stdoutSpillPath?: string };
    expect(details.stdoutTruncated).toBe(true);
    expect(details.stdoutSpillPath?.startsWith(spillDir)).toBe(true);
  });

  it("enforces timeout cap cleanly", async () => {
    const tool = createExecuteCodeTool({
      getSessionTools: () => [],
      sandbox: { sandboxEnabled: true, backend: "e2b" },
      runner: async () => new Promise(() => {}),
    });
    await expect(tool.execute("t-1", { code: "sleep(10)", timeoutMs: 25 })).rejects.toThrow(
      "timed out after 25ms",
    );
  });
});
