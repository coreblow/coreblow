import type { ToolFsPolicy } from "../agents/tool-fs-policy.types.js";
import type { AnyAgentTool } from "../agents/tools/common.js";
import type { CoreBlowConfig } from "../config/types.coreblow.js";
import type { HookEntry } from "../hooks/types.js";
import type { DeliveryContext } from "../utils/delivery-context.types.js";

export type CoreBlowPluginActiveModelContext = {
  provider?: string;
  modelId?: string;
  modelRef?: string;
};

/** Trusted execution context passed to plugin-owned agent tool factories. */
export type CoreBlowPluginToolContext = {
  config?: CoreBlowConfig;
  /** Active runtime-resolved config snapshot when one is available. */
  runtimeConfig?: CoreBlowConfig;
  /** Returns the latest runtime-resolved config snapshot for long-lived tool definitions. */
  getRuntimeConfig?: () => CoreBlowConfig | undefined;
  /** Effective filesystem policy for the active tool run. */
  fsPolicy?: ToolFsPolicy;
  workspaceDir?: string;
  agentDir?: string;
  agentId?: string;
  sessionKey?: string;
  /** Ephemeral session UUID - regenerated on /new and /reset. Use for per-conversation isolation. */
  sessionId?: string;
  /**
   * Runtime-supplied active model metadata for informational use, diagnostics,
   * and plugin-owned policy decisions. This is not a security boundary against
   * the local operator, installed plugin code, or a modified CoreBlow runtime.
   */
  activeModel?: CoreBlowPluginActiveModelContext;
  browser?: {
    sandboxBridgeUrl?: string;
    allowHostControl?: boolean;
  };
  messageChannel?: string;
  agentAccountId?: string;
  /** Trusted provider auth availability from the active auth profile store. */
  hasAuthForProvider?: (providerId: string) => boolean;
  /** Resolves an API key from the active auth profile store when available. */
  resolveApiKeyForProvider?: (providerId: string) => Promise<string | undefined>;
  /** Trusted ambient delivery route for the active agent/session. */
  deliveryContext?: DeliveryContext;
  /** Trusted sender id from inbound context (runtime-provided, not tool args). */
  requesterSenderId?: string;
  /** Whether the trusted sender is an owner. */
  senderIsOwner?: boolean;
  sandboxed?: boolean;
};

export type CoreBlowPluginToolFactory = (
  ctx: CoreBlowPluginToolContext,
) => AnyAgentTool | AnyAgentTool[] | null | undefined;

export type CoreBlowPluginToolOptions = {
  name?: string;
  names?: string[];
  optional?: boolean;
};

export type CoreBlowPluginHookOptions = {
  entry?: HookEntry;
  name?: string;
  description?: string;
  register?: boolean;
};

/** Backward-compatibility aliases */
export type OpenClawPluginActiveModelContext = CoreBlowPluginActiveModelContext;
export type OpenClawPluginToolContext = CoreBlowPluginToolContext;
export type OpenClawPluginToolFactory = CoreBlowPluginToolFactory;
export type OpenClawPluginToolOptions = CoreBlowPluginToolOptions;
export type OpenClawPluginHookOptions = CoreBlowPluginHookOptions;
