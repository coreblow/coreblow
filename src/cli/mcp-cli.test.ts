import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { withTempHome } from "../config/home-env.test-harness.js";
import { createCliRuntimeCapture } from "./test-runtime-capture.js";

const { defaultRuntime, resetRuntimeCapture, mockLog, mockError, serveCoreBlowChannelMcp } =
  vi.hoisted(() => {
    const runtimeLogs: string[] = [];
    const runtimeErrors: string[] = [];
    const stringifyArgs = (args: unknown[]) => args.map((value) => String(value)).join(" ");
    const log = vi.fn((...args: unknown[]) => {
      runtimeLogs.push(stringifyArgs(args));
    });
    const error = vi.fn((...args: unknown[]) => {
      runtimeErrors.push(stringifyArgs(args));
    });
    const mockRuntime = {
      log,
      error,
      writeStdout: vi.fn((value: string) => {
        log(value.endsWith("\n") ? value.slice(0, -1) : value);
      }),
      writeJson: vi.fn((value: unknown, space = 2) => {
        log(JSON.stringify(value, null, space > 0 ? space : undefined));
      }),
      exit: vi.fn((code: number) => {
        throw new Error(`__exit__:${code}`);
      }),
    };
    return {
      defaultRuntime: mockRuntime,
      resetRuntimeCapture: () => {
        runtimeLogs.length = 0;
        runtimeErrors.length = 0;
      },
      mockLog: log,
      mockError: error,
      serveCoreBlowChannelMcp: vi.fn(),
    };
  });

vi.mock("../runtime.js", () => ({
  defaultRuntime,
}));

vi.mock("../mcp/channel-server.js", () => ({
  serveCoreBlowChannelMcp,
}));

const tempDirs: string[] = [];

async function createWorkspace(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-cli-mcp-"));
  tempDirs.push(dir);
  return dir;
}

let registerMcpCli: typeof import("./mcp-cli.js").registerMcpCli;
let sharedProgram: Command;

async function runMcpCommand(args: string[]) {
  await sharedProgram.parseAsync(args, { from: "user" });
}

describe("mcp cli", () => {
  beforeAll(async () => {
    ({ registerMcpCli } = await import("./mcp-cli.js"));
    sharedProgram = new Command();
    sharedProgram.exitOverride();
    registerMcpCli(sharedProgram);
  }, 300_000);

  beforeEach(() => {
    vi.clearAllMocks();
    resetRuntimeCapture();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(
      tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    );
  });

  it("sets and shows a configured MCP server", async () => {
    await withTempHome("coreblow-cli-mcp-home-", async () => {
      const workspaceDir = await createWorkspace();
      vi.spyOn(process, "cwd").mockReturnValue(workspaceDir);

      await runMcpCommand(["mcp", "set", "context7", '{"command":"uvx","args":["context7-mcp"]}']);
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Saved MCP server "context7"'));

      mockLog.mockClear();
      await runMcpCommand(["mcp", "show", "context7", "--json"]);
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('"command": "uvx"'));
    });
  });

  it("fails when removing an unknown MCP server", async () => {
    await withTempHome("coreblow-cli-mcp-home-", async () => {
      const workspaceDir = await createWorkspace();
      vi.spyOn(process, "cwd").mockReturnValue(workspaceDir);

      await expect(runMcpCommand(["mcp", "unset", "missing"])).rejects.toThrow("__exit__:1");
      expect(mockError).toHaveBeenCalledWith(
        expect.stringContaining('No MCP server named "missing"'),
      );
    });
  });

  it("starts the channel bridge with parsed serve options", async () => {
    await withTempHome("coreblow-cli-mcp-home-", async () => {
      const workspaceDir = await createWorkspace();
      const tokenFile = path.join(workspaceDir, "gateway.token");
      vi.spyOn(process, "cwd").mockReturnValue(workspaceDir);
      await fs.writeFile(tokenFile, "secret-token\n", "utf-8");

      await runMcpCommand([
        "mcp",
        "serve",
        "--url",
        "ws://127.0.0.1:18789",
        "--token-file",
        tokenFile,
        "--channel-mode",
        "on",
        "--verbose",
      ]);

      expect(serveCoreBlowChannelMcp).toHaveBeenCalledWith({
        gatewayUrl: "ws://127.0.0.1:18789",
        gatewayToken: "secret-token",
        gatewayPassword: undefined,
        channelMode: "on",
        verbose: true,
      });
    });
  });
});
