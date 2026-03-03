import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetProcessRegistryForTests } from "./bash-process-registry.js";
import { createExecTool } from "./bash-tools.exec.js";
import { resolveShellFromPath } from "./shell-utils.js";

const isWin = process.platform === "win32";
const defaultShell = isWin
  ? undefined
  : process.env.COREBLOW_TEST_SHELL || resolveShellFromPath("bash") || process.env.SHELL || "sh";
const longDelayCmd = isWin ? "Start-Sleep -Milliseconds 72" : "sleep 0.072";

describe("exec foreground failures", () => {
  beforeEach(() => {
    if (!isWin && defaultShell) {
      process.env.SHELL = defaultShell;
    }
    resetProcessRegistryForTests();
  });

  afterEach(() => {
    resetProcessRegistryForTests();
  });

  it("returns a failed text result when the default timeout is exceeded", async () => {
    const tool = createExecTool({
      security: "full",
      ask: "off",
      timeoutSec: 0.05,
      backgroundMs: 10,
      allowBackground: false,
    });

    const result = await tool.execute("call-timeout", {
      command: longDelayCmd,
    });

    expect(result.content[0]).toMatchObject({ type: "text" });
    expect((result.content[0] as { text?: string }).text).toMatch(/timed out/i);
    expect(result.details).toMatchObject({
      status: "failed",
      exitCode: null,
    });
    expect((result.details as { durationMs?: number }).durationMs).toEqual(expect.any(Number));
  });
});
