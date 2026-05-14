import { beforeEach, describe, expect, it, vi } from "vitest";

const { execDockerRawMock } = vi.hoisted(() => ({
  execDockerRawMock: vi.fn(),
}));

describe("runDockerSandboxShellCommand", () => {
  beforeEach(() => {
    vi.resetModules();
    execDockerRawMock.mockReset();
    vi.doMock("./docker.js", () => ({
      dockerContainerState: vi.fn(),
      ensureSandboxContainer: vi.fn(),
      execDocker: vi.fn(),
      execDockerRaw: (...args: unknown[]) => execDockerRawMock(...args),
    }));
  });

  it("uses the rebranded sandbox command name while exposing the legacy name", async () => {
    const { runDockerSandboxShellCommand } = await import("./docker-backend.js");
    execDockerRawMock.mockReturnValueOnce({ stdout: Buffer.alloc(0), stderr: Buffer.alloc(0), code: 0 });

    runDockerSandboxShellCommand({
      containerName: "coreblow-sbx-test",
      script: "printf ok",
      args: ["one"],
    });

    expect(execDockerRawMock).toHaveBeenCalledWith(
      [
        "exec",
        "-i",
        "-e",
        "COREBLOW_SANDBOX_FS_COMMAND=blowbot-sandbox-fs",
        "-e",
        "COREBLOW_LEGACY_SANDBOX_FS_COMMAND=moltbot-sandbox-fs",
        "coreblow-sbx-test",
        "sh",
        "-c",
        "printf ok",
        "blowbot-sandbox-fs",
        "one",
      ],
      {
        input: undefined,
        allowFailure: undefined,
        signal: undefined,
      },
    );
  });
});
