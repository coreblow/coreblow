import { resolveHeartbeatPrompt } from "../../auto-reply/heartbeat.js";
import { resolveSessionAgentIds } from "../agent-scope.js";
import {
  buildBootstrapInjectionStats,
  buildBootstrapPromptWarning,
  buildBootstrapTruncationReportMeta,
  analyzeBootstrapBudget,
} from "../bootstrap-budget.js";
import { makeBootstrapWarn, resolveBootstrapContextForRun } from "../bootstrap-files.js";
import { resolveCliBackendConfig } from "../cli-backends.js";
import { hashCliSessionText, resolveCliSessionReuse } from "../cli-session.js";
import { resolveCoreBlowDocsPath } from "../docs-path.js";
import {
  createMcpLoopbackServerConfig,
  getActiveMcpLoopbackRuntime,
} from "../../gateway/mcp-http.loopback-runtime.js";
import {
  resolveBootstrapMaxChars,
  resolveBootstrapPromptTruncationWarningMode,
  resolveBootstrapTotalMaxChars,
} from "../pi-embedded-helpers.js";
import { buildSystemPromptReport } from "../system-prompt-report.js";
import { redactRunIdentifier, resolveRunWorkspaceDir } from "../workspace-run.js";
import { prepareCliBundleMcpConfig } from "./bundle-mcp.js";
import { buildSystemPrompt, normalizeCliModel } from "./helpers.js";
import { cliBackendLog } from "./log.js";
import type { PreparedCliRunContext, RunCliAgentParams } from "./types.js";

const prepareDeps = {
  ensureMcpLoopbackServer: async () => {
    const { ensureMcpLoopbackServer } = await import("../../gateway/mcp-http.js");
    await ensureMcpLoopbackServer();
  },
  getActiveMcpLoopbackRuntime,
  createMcpLoopbackServerConfig,
};

export function setCliRunnerPrepareTestDeps(overrides: Partial<typeof prepareDeps>): void {
  Object.assign(prepareDeps, overrides);
}

export async function prepareCliRunContext(
  params: RunCliAgentParams,
): Promise<PreparedCliRunContext> {
  const started = Date.now();
  const workspaceResolution = resolveRunWorkspaceDir({
    workspaceDir: params.workspaceDir,
    sessionKey: params.sessionKey,
    agentId: params.agentId,
    config: params.config,
  });
  const resolvedWorkspace = workspaceResolution.workspaceDir;
  const redactedSessionId = redactRunIdentifier(params.sessionId);
  const redactedSessionKey = redactRunIdentifier(params.sessionKey);
  const redactedWorkspace = redactRunIdentifier(resolvedWorkspace);
  if (workspaceResolution.usedFallback) {
    cliBackendLog.warn(
      `[workspace-fallback] caller=runCliAgent reason=${workspaceResolution.fallbackReason} run=${params.runId} session=${redactedSessionId} sessionKey=${redactedSessionKey} agent=${workspaceResolution.agentId} workspace=${redactedWorkspace}`,
    );
  }
  const workspaceDir = resolvedWorkspace;

  const backendResolved = resolveCliBackendConfig(params.provider, params.config);
  if (!backendResolved) {
    throw new Error(`Unknown CLI backend: ${params.provider}`);
  }
  const { defaultAgentId, sessionAgentId } = resolveSessionAgentIds({
    sessionKey: params.sessionKey,
    config: params.config,
    agentId: params.agentId,
  });
  const bundleMcpEnabled = backendResolved.bundleMcp;
  let mcpLoopbackRuntime = bundleMcpEnabled ? prepareDeps.getActiveMcpLoopbackRuntime() : undefined;
  if (bundleMcpEnabled && !mcpLoopbackRuntime) {
    try {
      await prepareDeps.ensureMcpLoopbackServer();
    } catch (error) {
      cliBackendLog.warn(`mcp loopback server failed to start: ${String(error)}`);
    }
    mcpLoopbackRuntime = prepareDeps.getActiveMcpLoopbackRuntime();
  }
  const preparedBackend = await prepareCliBundleMcpConfig({
    enabled: backendResolved.bundleMcp,
    backend: backendResolved.config,
    workspaceDir,
    config: params.config,
    additionalConfig: mcpLoopbackRuntime
      ? prepareDeps.createMcpLoopbackServerConfig(mcpLoopbackRuntime.port)
      : undefined,
    env: mcpLoopbackRuntime
      ? {
          COREBLOW_MCP_TOKEN:
            params.senderIsOwner === true
              ? mcpLoopbackRuntime.ownerToken
              : mcpLoopbackRuntime.nonOwnerToken,
          COREBLOW_MCP_AGENT_ID: sessionAgentId ?? "",
          COREBLOW_MCP_ACCOUNT_ID: params.agentAccountId ?? "",
          COREBLOW_MCP_SESSION_KEY: params.sessionKey ?? "",
          COREBLOW_MCP_MESSAGE_CHANNEL: params.messageChannel ?? params.messageProvider ?? "",
          COREBLOW_MCP_INBOUND_EVENT_KIND: params.currentInboundEventKind ?? "",
        }
      : undefined,
    warn: (message) => cliBackendLog.warn(message),
  });
  const extraSystemPrompt = params.extraSystemPrompt?.trim() ?? "";
  const extraSystemPromptHash = hashCliSessionText(extraSystemPrompt);
  const reusableCliSession = resolveCliSessionReuse({
    binding:
      params.cliSessionBinding ??
      (params.cliSessionId ? { sessionId: params.cliSessionId } : undefined),
    authProfileId: params.authProfileId,
    extraSystemPromptHash,
    mcpConfigHash: preparedBackend.mcpConfigHash,
  });
  if (reusableCliSession.invalidatedReason) {
    cliBackendLog.info(
      `cli session reset: provider=${params.provider} reason=${reusableCliSession.invalidatedReason}`,
    );
  }
  const modelId = (params.model ?? "default").trim() || "default";
  const normalizedModel = normalizeCliModel(modelId, preparedBackend.backend);
  const modelDisplay = `${params.provider}/${modelId}`;

  const sessionLabel = params.sessionKey ?? params.sessionId;
  const { files: bootstrapFiles, content: contextFiles } = await resolveBootstrapContextForRun({
    workspaceDir,
  } as Parameters<typeof resolveBootstrapContextForRun>[0]);
  const bootstrapMaxChars = resolveBootstrapMaxChars(params.config);
  const bootstrapTotalMaxChars = resolveBootstrapTotalMaxChars(params.config);
  const bootstrapAnalysis = analyzeBootstrapBudget({
    files: buildBootstrapInjectionStats({
      bootstrapFiles: bootstrapFiles as never,
      injectedFiles: contextFiles as never,
    }),
    bootstrapMaxChars,
    bootstrapTotalMaxChars,
  });
  const bootstrapPromptWarningMode = resolveBootstrapPromptTruncationWarningMode(params.config);
  const bootstrapPromptWarning = buildBootstrapPromptWarning({
    analysis: bootstrapAnalysis,
    mode: bootstrapPromptWarningMode,
    seenSignatures: params.bootstrapPromptWarningSignaturesSeen,
    previousSignature: params.bootstrapPromptWarningSignature,
  });
  const heartbeatPrompt =
    sessionAgentId === defaultAgentId
      ? resolveHeartbeatPrompt(params.config?.agents?.defaults?.heartbeat?.prompt)
      : undefined;
  const docsPath = await resolveCoreBlowDocsPath({
    workspaceDir,
    argv1: process.argv[1],
    cwd: process.cwd(),
    moduleUrl: import.meta.url,
  });
  const systemPrompt = buildSystemPrompt({
    workspaceDir,
    config: params.config,
    defaultThinkLevel: params.thinkLevel,
    extraSystemPrompt,
    ownerNumbers: params.ownerNumbers,
    heartbeatPrompt,
    docsPath: docsPath ?? undefined,
    tools: [],
    contextFiles: contextFiles as never,
    modelDisplay,
    agentId: sessionAgentId,
  });
  const systemPromptReport = buildSystemPromptReport({
    source: "run",
    generatedAt: Date.now(),
    sessionId: params.sessionId,
    sessionKey: params.sessionKey,
    provider: params.provider,
    model: modelId,
    workspaceDir,
    bootstrapMaxChars,
    bootstrapTotalMaxChars,
    bootstrapTruncation: buildBootstrapTruncationReportMeta({
      analysis: bootstrapAnalysis,
      warningMode: bootstrapPromptWarningMode,
      warning: bootstrapPromptWarning,
    }),
    sandbox: { mode: "off", sandboxed: false },
    systemPrompt,
    bootstrapFiles: bootstrapFiles as never,
    injectedFiles: contextFiles as never,
    skillsPrompt: "",
    tools: [],
  });

  return {
    params,
    started,
    workspaceDir,
    backendResolved,
    preparedBackend,
    reusableCliSession,
    modelId,
    normalizedModel,
    systemPrompt,
    systemPromptReport,
    bootstrapPromptWarningLines: bootstrapPromptWarning.lines,
    heartbeatPrompt,
    extraSystemPromptHash,
  };
}
