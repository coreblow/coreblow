import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import { getChannelAgentToolMeta } from "../agents/channel-tools.js";
import { createCoreBlowTools } from "../agents/coreblow-tools.js";
import { runBeforeToolCallHook } from "../agents/pi-tools.before-tool-call.js";
import { resolveToolLoopDetectionConfig } from "../agents/pi-tools.js";
import {
  resolveEffectiveToolPolicy,
  resolveGroupToolPolicy,
  resolveSubagentToolPolicy,
} from "../agents/pi-tools.policy.js";
import {
  applyToolPolicyPipeline,
  buildDefaultToolPolicyPipelineSteps,
} from "../agents/tool-policy-pipeline.js";
import {
  applyOwnerOnlyToolPolicy,
  collectExplicitAllowlist,
  mergeAlsoAllowPolicy,
  resolveToolProfilePolicy,
} from "../agents/tool-policy.js";
import { ToolInputError, type AnyAgentTool } from "../agents/tools/common.js";
import type { CoreBlowConfig } from "../config/config.js";
import { resolveMainSessionKey } from "../config/sessions.js";
import { logWarn } from "../logger.js";
import { isTestDefaultMemorySlotDisabled } from "../plugins/config-state.js";
import { getPluginToolMeta } from "../plugins/tools.js";
import { isSubagentSessionKey } from "../routing/session-key.js";
import { DEFAULT_GATEWAY_HTTP_TOOL_DENY } from "../security/dangerous-tools.js";

const MEMORY_TOOL_NAMES = new Set(["memory_search", "memory_get"]);

export type ToolsInvokeInput = {
  tool?: unknown;
  name?: unknown;
  action?: unknown;
  args?: unknown;
  sessionKey?: unknown;
  dryRun?: unknown;
};

type ToolsInvokeErrorType = "invalid_request" | "not_found" | "tool_call_blocked" | "tool_error";
type GatewayScopedToolSurface = "http" | "loopback";

export type ToolsInvokeOutcome =
  | {
      ok: true;
      status: 200;
      toolName: string;
      source: "core" | "plugin" | "channel";
      result: unknown;
    }
  | {
      ok: false;
      status: 400 | 403 | 404 | 500;
      toolName: string;
      error: {
        type: ToolsInvokeErrorType;
        message: string;
      };
    };

export type GatewayScopedToolsResult = {
  agentId: string | undefined;
  sessionKey: string;
  tools: AnyAgentTool[];
};

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function resolveSessionKey(params: { cfg: CoreBlowConfig; input: ToolsInvokeInput }): string {
  const rawSessionKey = normalizeOptionalString(params.input.sessionKey);
  return !rawSessionKey || rawSessionKey === "main"
    ? resolveMainSessionKey(params.cfg)
    : rawSessionKey;
}

function resolveMemoryToolDisableReasons(cfg: CoreBlowConfig): string[] {
  if (!process.env.VITEST) {
    return [];
  }
  const reasons: string[] = [];
  const plugins = cfg.plugins;
  const slotRaw = plugins?.slots?.memory;
  const slotDisabled =
    slotRaw === null || (typeof slotRaw === "string" && slotRaw.trim().toLowerCase() === "none");
  const pluginsDisabled = plugins?.enabled === false;
  const defaultDisabled = isTestDefaultMemorySlotDisabled(cfg);

  if (pluginsDisabled) {
    reasons.push("plugins.enabled=false");
  }
  if (slotDisabled) {
    reasons.push(slotRaw === null ? "plugins.slots.memory=null" : 'plugins.slots.memory="none"');
  }
  if (!pluginsDisabled && !slotDisabled && defaultDisabled) {
    reasons.push("memory plugin disabled by test default");
  }
  return reasons;
}

function mergeActionIntoArgsIfSupported(params: {
  toolSchema: unknown;
  action: string | undefined;
  args: Record<string, unknown>;
}): Record<string, unknown> {
  if (!params.action || params.args.action !== undefined) {
    return params.args;
  }
  const schemaObj = params.toolSchema as { properties?: Record<string, unknown> } | null;
  const hasAction = Boolean(
    schemaObj &&
    typeof schemaObj === "object" &&
    schemaObj.properties &&
    "action" in schemaObj.properties,
  );
  return hasAction ? { ...params.args, action: params.action } : params.args;
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message || String(err) : String(err);
}

function resolveToolInputErrorStatus(err: unknown): number | null {
  if (err instanceof ToolInputError) {
    const status = (err as { status?: unknown }).status;
    return typeof status === "number" ? status : 400;
  }
  if (typeof err !== "object" || err === null || !("name" in err)) {
    return null;
  }
  const name = (err as { name?: unknown }).name;
  if (name !== "ToolInputError" && name !== "ToolAuthorizationError") {
    return null;
  }
  const status = (err as { status?: unknown }).status;
  if (typeof status === "number") {
    return status;
  }
  return name === "ToolAuthorizationError" ? 403 : 400;
}

function resolveToolSource(tool: AnyAgentTool): "core" | "plugin" | "channel" {
  if (getPluginToolMeta(tool)) {
    return "plugin";
  }
  if (getChannelAgentToolMeta(tool as never)) {
    return "channel";
  }
  return "core";
}

export function resolveGatewayScopedTools(params: {
  cfg: CoreBlowConfig;
  sessionKey: string;
  senderIsOwner: boolean;
  messageChannel?: string;
  accountId?: string;
  agentTo?: string;
  agentThreadId?: string;
  allowGatewaySubagentBinding?: boolean;
  allowMediaInvokeCommands?: boolean;
  surface?: GatewayScopedToolSurface;
  excludeToolNames?: Iterable<string>;
}): GatewayScopedToolsResult {
  const {
    agentId,
    globalPolicy,
    globalProviderPolicy,
    agentPolicy,
    agentProviderPolicy,
    profile,
    providerProfile,
    profileAlsoAllow,
    providerProfileAlsoAllow,
  } = resolveEffectiveToolPolicy({ config: params.cfg, sessionKey: params.sessionKey });
  const profilePolicy = resolveToolProfilePolicy(profile);
  const providerProfilePolicy = resolveToolProfilePolicy(providerProfile);
  const groupPolicy = resolveGroupToolPolicy({
    config: params.cfg,
    sessionKey: params.sessionKey,
    messageProvider: params.messageChannel,
    accountId: params.accountId ?? null,
  });
  const subagentPolicy = isSubagentSessionKey(params.sessionKey)
    ? resolveSubagentToolPolicy(params.cfg)
    : undefined;
  const workspaceDir = resolveAgentWorkspaceDir(
    params.cfg,
    agentId ?? resolveDefaultAgentId(params.cfg),
  );

  const allTools = createCoreBlowTools({
    agentSessionKey: params.sessionKey,
    agentChannel: params.messageChannel,
    agentAccountId: params.accountId,
    agentTo: params.agentTo,
    agentThreadId: params.agentThreadId,
    senderIsOwner: params.senderIsOwner,
    allowGatewaySubagentBinding: params.allowGatewaySubagentBinding ?? true,
    allowMediaInvokeCommands: params.allowMediaInvokeCommands ?? true,
    config: params.cfg,
    workspaceDir,
    pluginToolAllowlist: collectExplicitAllowlist([
      profilePolicy,
      providerProfilePolicy,
      globalPolicy,
      globalProviderPolicy,
      agentPolicy,
      agentProviderPolicy,
      groupPolicy,
      subagentPolicy,
    ]),
  });
  const policyFiltered = applyToolPolicyPipeline({
    tools: allTools as unknown as AnyAgentTool[],
    toolMeta: (tool) => getPluginToolMeta(tool),
    warn: logWarn,
    steps: [
      ...buildDefaultToolPolicyPipelineSteps({
        profilePolicy: mergeAlsoAllowPolicy(profilePolicy, profileAlsoAllow),
        profile,
        profileAlsoAllow,
        providerProfilePolicy: mergeAlsoAllowPolicy(providerProfilePolicy, providerProfileAlsoAllow),
        providerProfile,
        providerProfileAlsoAllow,
        globalPolicy,
        globalProviderPolicy,
        agentPolicy,
        agentProviderPolicy,
        groupPolicy,
        agentId,
      }),
      { policy: subagentPolicy, label: "subagent tools.allow" },
    ],
  });

  const gatewayToolsCfg = params.cfg.gateway?.tools;
  const surface = params.surface ?? "http";
  const defaultGatewayDeny =
    surface === "http"
      ? DEFAULT_GATEWAY_HTTP_TOOL_DENY.filter((name) => !gatewayToolsCfg?.allow?.includes(name))
      : [];
  const excludeToolNames = params.excludeToolNames ? Array.from(params.excludeToolNames) : [];
  const gatewayDenySet = new Set([
    ...defaultGatewayDeny,
    ...(Array.isArray(gatewayToolsCfg?.deny) ? gatewayToolsCfg.deny : []),
    ...excludeToolNames,
  ]);
  return {
    agentId,
    sessionKey: params.sessionKey,
    tools: applyOwnerOnlyToolPolicy(
      policyFiltered.filter((tool) => !gatewayDenySet.has(tool.name)),
      params.senderIsOwner,
    ),
  };
}

export async function invokeGatewayTool(params: {
  cfg: CoreBlowConfig;
  input: ToolsInvokeInput;
  senderIsOwner: boolean;
  messageChannel?: string;
  accountId?: string;
  agentTo?: string;
  agentThreadId?: string;
  toolCallIdPrefix: string;
}): Promise<ToolsInvokeOutcome> {
  const toolName = normalizeOptionalString(params.input.name ?? params.input.tool) ?? "";
  if (!toolName) {
    return {
      ok: false,
      status: 400,
      toolName: "",
      error: { type: "invalid_request", message: "tools.invoke requires body.tool" },
    };
  }

  if (process.env.VITEST && MEMORY_TOOL_NAMES.has(toolName)) {
    const reasons = resolveMemoryToolDisableReasons(params.cfg);
    if (reasons.length > 0) {
      const suffix = ` (${reasons.join(", ")})`;
      return {
        ok: false,
        status: 400,
        toolName,
        error: {
          type: "invalid_request",
          message:
            `memory tools are disabled in tests${suffix}. ` +
            'Enable by setting plugins.slots.memory="memory-core" (and ensure plugins.enabled is not false).',
        },
      };
    }
  }

  const action = normalizeOptionalString(params.input.action);
  const argsRaw = params.input.args;
  const args =
    argsRaw && typeof argsRaw === "object" && !Array.isArray(argsRaw)
      ? (argsRaw as Record<string, unknown>)
      : {};
  const sessionKey = resolveSessionKey({ cfg: params.cfg, input: params.input });
  const scopedTools = resolveGatewayScopedTools({
    cfg: params.cfg,
    sessionKey,
    senderIsOwner: params.senderIsOwner,
    messageChannel: params.messageChannel,
    accountId: params.accountId,
    agentTo: params.agentTo,
    agentThreadId: params.agentThreadId,
    surface: "http",
  });
  const { agentId, tools } = scopedTools;
  const tool = tools.find((candidate) => candidate.name === toolName);
  if (!tool) {
    return {
      ok: false,
      status: 404,
      toolName,
      error: { type: "not_found", message: `Tool not available: ${toolName}` },
    };
  }

  try {
    const toolCallId = `${params.toolCallIdPrefix}-${Date.now()}`;
    const toolArgs = mergeActionIntoArgsIfSupported({
      toolSchema: tool.parameters,
      action,
      args,
    });
    const hookResult = await runBeforeToolCallHook({
      toolName,
      params: toolArgs,
      toolCallId,
      ctx: {
        agentId,
        sessionKey,
        loopDetection: resolveToolLoopDetectionConfig({ cfg: params.cfg, agentId }),
      },
    });
    if (hookResult.blocked) {
      return {
        ok: false,
        status: 403,
        toolName,
        error: { type: "tool_call_blocked", message: hookResult.reason },
      };
    }
    return {
      ok: true,
      status: 200,
      toolName,
      source: resolveToolSource(tool),
      result: await tool.execute?.(toolCallId, hookResult.params),
    };
  } catch (err) {
    const inputStatus = resolveToolInputErrorStatus(err);
    if (inputStatus !== null) {
      return {
        ok: false,
        status: inputStatus === 403 ? 403 : 400,
        toolName,
        error: {
          type: "tool_error",
          message: getErrorMessage(err) || "invalid tool arguments",
        },
      };
    }
    logWarn(`tools-invoke: tool execution failed: ${String(err)}`);
    return {
      ok: false,
      status: 500,
      toolName,
      error: { type: "tool_error", message: "tool execution failed" },
    };
  }
}
