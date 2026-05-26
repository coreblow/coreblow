import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const ensureMcpLoopbackServerMock = vi.hoisted(() => vi.fn());
const getActiveMcpLoopbackRuntimeMock = vi.hoisted(() => vi.fn());
const createMcpLoopbackServerConfigMock = vi.hoisted(() => vi.fn());

const cliBackendsMock = vi.hoisted(() => () => ({
  resolveCliBackendConfig: () => ({
    id: "claude-cli",
    config: {
      command: "node",
      args: ["./fake-claude.mjs"],
    },
    bundleMcp: true,
  }),
}));

vi.mock("../bootstrap-files.js", () => ({
  makeBootstrapWarn: () => () => undefined,
  resolveBootstrapContextForRun: async () => ({ files: [], content: [] }),
}));

vi.mock("../bootstrap-budget.js", () => ({
  buildBootstrapInjectionStats: () => [],
  analyzeBootstrapBudget: () => ({}),
  buildBootstrapPromptWarning: () => ({ lines: [] }),
  buildBootstrapTruncationReportMeta: () => ({}),
}));

vi.mock("../docs-path.js", () => ({
  resolveCoreBlowDocsPath: async () => undefined,
}));

vi.mock("../system-prompt-report.js", () => ({
  buildSystemPromptReport: () => ({}),
}));

vi.mock("./helpers.js", () => ({
  buildSystemPrompt: () => "system prompt",
  normalizeCliModel: (model: string) => model,
}));

async function makeWorkspace() {
  return await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-prepare-mcp-loopback-"));
}

describe("prepareCliRunContext bundle MCP loopback", () => {
  afterEach(async () => {
    const { setCliRunnerPrepareTestDeps } = await import("./prepare.js");
    setCliRunnerPrepareTestDeps({
      ensureMcpLoopbackServer: async () => {
        const { ensureMcpLoopbackServer } = await import("../../gateway/mcp-http.js");
        await ensureMcpLoopbackServer();
      },
      getActiveMcpLoopbackRuntime: (await import("../../gateway/mcp-http.loopback-runtime.js"))
        .getActiveMcpLoopbackRuntime,
      createMcpLoopbackServerConfig: (await import("../../gateway/mcp-http.loopback-runtime.js"))
        .createMcpLoopbackServerConfig,
    });
    vi.restoreAllMocks();
  });

  it("starts the MCP loopback server and injects CoreBlow config/env into bundle MCP", async () => {
    const workspaceDir = await makeWorkspace();
    getActiveMcpLoopbackRuntimeMock
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({
        port: 4321,
        ownerToken: "owner-token",
        nonOwnerToken: "non-owner-token",
      });
    createMcpLoopbackServerConfigMock.mockReturnValue({
      mcpServers: {
        coreblow: {
          type: "http",
          url: "http://127.0.0.1:4321/mcp",
          headers: {
            Authorization: "Bearer ${COREBLOW_MCP_TOKEN}",
            "x-coreblow-message-channel": "${COREBLOW_MCP_MESSAGE_CHANNEL}",
          },
        },
      },
    });
    vi.resetModules();
    vi.doMock("../cli-backends.js", cliBackendsMock);
    vi.doMock("../cli-backends.ts", cliBackendsMock);
    const { prepareCliRunContext, setCliRunnerPrepareTestDeps } = await import("./prepare.js");
    setCliRunnerPrepareTestDeps({
      ensureMcpLoopbackServer: ensureMcpLoopbackServerMock,
      getActiveMcpLoopbackRuntime: getActiveMcpLoopbackRuntimeMock,
      createMcpLoopbackServerConfig: createMcpLoopbackServerConfigMock,
    });

    const prepared = await prepareCliRunContext({
      sessionId: "session-1",
      sessionKey: "agent:main:main",
      agentId: "main",
      sessionFile: path.join(workspaceDir, "session.json"),
      workspaceDir,
      config: { agents: { list: [{ id: "main", default: true }] } },
      prompt: "hello",
      provider: "claude-cli",
      model: "sonnet",
      timeoutMs: 1_000,
      runId: "run-1",
      senderIsOwner: true,
      messageChannel: "telegram",
      agentAccountId: "acct-1",
      currentInboundEventKind: "user_request",
    });

    const configFlagIndex = prepared.preparedBackend.backend.args?.indexOf("--mcp-config") ?? -1;
    const generatedConfigPath = prepared.preparedBackend.backend.args?.[configFlagIndex + 1];
    const raw = JSON.parse(await fs.readFile(generatedConfigPath as string, "utf-8")) as {
      mcpServers?: Record<string, unknown>;
    };

    expect(ensureMcpLoopbackServerMock).toHaveBeenCalledTimes(1);
    expect(createMcpLoopbackServerConfigMock).toHaveBeenCalledWith(4321);
    expect(raw.mcpServers?.coreblow).toEqual({
      type: "http",
      url: "http://127.0.0.1:4321/mcp",
      headers: {
        Authorization: "Bearer ${COREBLOW_MCP_TOKEN}",
        "x-coreblow-message-channel": "${COREBLOW_MCP_MESSAGE_CHANNEL}",
      },
    });
    expect(prepared.preparedBackend.backend.env).toMatchObject({
      COREBLOW_MCP_TOKEN: "owner-token",
      COREBLOW_MCP_AGENT_ID: "main",
      COREBLOW_MCP_ACCOUNT_ID: "acct-1",
      COREBLOW_MCP_SESSION_KEY: "agent:main:main",
      COREBLOW_MCP_MESSAGE_CHANNEL: "telegram",
      COREBLOW_MCP_INBOUND_EVENT_KIND: "user_request",
    });

    await prepared.preparedBackend.cleanup?.();
    await fs.rm(workspaceDir, { recursive: true, force: true });
  });
});
