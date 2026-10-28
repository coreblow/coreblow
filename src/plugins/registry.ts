import path from "node:path";
import type { AnyAgentTool } from "../agents/tools/common.js";
import type { ChannelPlugin } from "../channels/plugins/types.js";
import type { CodexAppServerExtensionFactory } from "./codex-app-server-extension-types.js";
import type { MemoryEmbeddingProviderAdapter } from "./memory-embedding-providers.js";
import type { GatewayMethodDescriptor } from "../gateway/methods/descriptor.js";
import type { CoreBlowConfig } from "../config/types.coreblow.js";
import { registerContextEngineForOwner } from "../context-engine/registry.js";
import type { OperatorScope } from "../gateway/method-scopes.js";
import { isOperatorScope } from "../gateway/operator-scopes.js";
import { formatErrorMessage } from "../infra/errors.js";
import {
  NODE_EXEC_APPROVALS_COMMANDS,
  NODE_SYSTEM_NOTIFY_COMMAND,
  NODE_SYSTEM_RUN_COMMANDS,
} from "../infra/node-commands.js";
import type {
  GatewayRequestHandler,
  GatewayRequestHandlers,
} from "../gateway/server-methods/types.js";
import { registerInternalHook } from "../hooks/internal-hooks.js";
import type { HookEntry } from "../hooks/types.js";
import { resolveUserPath } from "../utils.js";
import { emitPluginAgentEvent } from "./agent-event-emission.js";
import { buildPluginApi } from "./api-builder.js";
import {
  isReservedCommandName,
  registerPluginCommand,
  validatePluginCommandDefinition,
} from "./command-registration.js";
import { pluginCommands } from "./command-registry-state.js";
import { sendPluginSessionAttachment } from "./host-hook-attachments.js";
import {
  clearPluginRunContext,
  getPluginRunContext,
  getPluginSessionSchedulerJobGeneration,
  registerPluginSessionSchedulerJob,
  setPluginRunContext,
} from "./host-hook-runtime.js";
import {
  schedulePluginSessionTurn,
  unschedulePluginSessionTurnsByTag,
} from "./host-hook-scheduled-turns.js";
import { enqueuePluginNextTurnInjection } from "./host-hook-state.js";
import {
  isPluginJsonValue,
  normalizePluginHostHookId,
  type PluginAgentEventSubscriptionRegistration,
  type PluginControlUiDescriptor,
  type PluginRuntimeLifecycleRegistration,
  type PluginSessionActionRegistration,
  type PluginSessionSchedulerJobRegistration,
  type PluginSessionExtensionRegistration,
  type PluginToolMetadataRegistration,
  type PluginTrustedToolPolicyRegistration,
} from "./host-hooks.js";
import { normalizePluginHttpPath } from "./http-path.js";
import { findOverlappingPluginHttpRoute } from "./http-route-overlap.js";
import { registerPluginInteractiveHandler } from "./interactive.js";
import {
  getRegisteredMemoryEmbeddingProvider,
  registerMemoryEmbeddingProvider,
} from "./memory-embedding-providers.js";
import {
  registerMemoryFlushPlanResolver,
  registerMemoryPromptSection,
  registerMemoryRuntime,
} from "./memory-state.js";
import { normalizeRegisteredProvider } from "./provider-validation.js";
import { createEmptyPluginRegistry } from "./registry-empty.js";
import { isPluginRegistryActivated, isPluginRegistryRetired } from "./registry-lifecycle.js";
import { getActivePluginRegistry } from "./runtime.js";
import { withPluginRuntimePluginIdScope } from "./runtime/gateway-request-scope.js";
import type { PluginRuntime } from "./runtime/types.js";
import { validateJsonSchemaValue } from "./schema-validator.js";
import { normalizeSessionEntrySlotKey } from "./session-entry-slot-keys.js";
import { defaultSlotIdForKey } from "./slots.js";
import {
  findUndeclaredPluginToolNames,
  normalizePluginToolContractNames,
} from "./tool-contracts.js";
import {
  isPluginHookName,
  isPromptInjectionHookName,
  stripPromptMutationFieldsFromLegacyHookResult,
} from "./types.js";
import type {
  CliBackendPlugin,
  ImageGenerationProviderPlugin,
  CoreBlowPluginApi,
  CoreBlowPluginChannelRegistration,
  CoreBlowPluginCliCommandDescriptor,
  CoreBlowPluginCliRegistrar,
  CoreBlowPluginCommandDefinition,
  PluginConversationBindingResolvedEvent,
  CoreBlowPluginHttpRouteAuth,
  CoreBlowPluginHttpRouteMatch,
  CoreBlowPluginHttpRouteHandler,
  CoreBlowPluginHttpRouteParams,
  CoreBlowPluginHookOptions,
  CoreBlowPluginNodeHostCommand,
  CoreBlowPluginNodeInvokePolicy,
  MediaUnderstandingProviderPlugin,
  MigrationProviderPlugin,
  MusicGenerationProviderPlugin,
  ProviderPlugin,
  RealtimeTranscriptionProviderPlugin,
  RealtimeVoiceProviderPlugin,
  CoreBlowPluginService,
  CoreBlowPluginToolContext,
  CoreBlowPluginToolFactory,
  AgentToolResultMiddleware,
  AgentToolResultMiddlewareRuntime,
  PluginConfigUiHint,
  PluginDiagnostic,
  PluginBundleFormat,
  PluginFormat,
  PluginLogger,
  PluginOrigin,
  PluginKind,
  PluginRegistrationMode,
  PluginHookName,
  PluginHookHandlerMap,
  PluginHookRegistration as TypedPluginHookRegistration,
  SpeechProviderPlugin,
  UnifiedModelCatalogProviderPlugin,
  VideoGenerationProviderPlugin,
  WebFetchProviderPlugin,
  WebSearchProviderPlugin,
} from "./types.js";

export type PluginToolRegistration = {
  pluginId: string;
  pluginName?: string;
  factory: CoreBlowPluginToolFactory;
  names: string[];
  optional: boolean;
  source: string;
  rootDir?: string;
};

export type PluginAgentToolResultMiddlewareRegistration = {
  pluginId: string;
  pluginName?: string;
  middleware: AgentToolResultMiddleware;
  handler?: AgentToolResultMiddleware;
  runtimes: readonly AgentToolResultMiddlewareRuntime[];
  source: string;
  rootDir?: string;
};

export type PluginCliRegistration = {
  pluginId: string;
  pluginName?: string;
  register: CoreBlowPluginCliRegistrar;
  parentPath?: string[];
  commands: string[];
  descriptors: CoreBlowPluginCliCommandDescriptor[];
  source: string;
  rootDir?: string;
};

export type PluginHttpRouteRegistration = {
  pluginId?: string;
  path: string;
  handler: CoreBlowPluginHttpRouteHandler;
  auth: CoreBlowPluginHttpRouteAuth;
  match: CoreBlowPluginHttpRouteMatch;
  source?: string;
};

export type PluginChannelRegistration = {
  pluginId: string;
  pluginName?: string;
  plugin: ChannelPlugin;
  source: string;
  rootDir?: string;
};

export type PluginChannelSetupRegistration = {
  pluginId: string;
  pluginName?: string;
  plugin: ChannelPlugin;
  source: string;
  enabled: boolean;
  rootDir?: string;
};

export type PluginProviderRegistration = {
  pluginId: string;
  pluginName?: string;
  provider: ProviderPlugin;
  source: string;
  rootDir?: string;
};

export type PluginModelCatalogProviderRegistration = {
  pluginId: string;
  pluginName?: string;
  provider: UnifiedModelCatalogProviderPlugin;
  source: string;
  rootDir?: string;
};

export type PluginCliBackendRegistration = {
  pluginId: string;
  pluginName?: string;
  backend: CliBackendPlugin;
  source: string;
  rootDir?: string;
};

type PluginOwnedProviderRegistration<T extends { id: string }> = {
  pluginId: string;
  pluginName?: string;
  provider: T;
  source: string;
  rootDir?: string;
};

export type PluginSpeechProviderRegistration =
  PluginOwnedProviderRegistration<SpeechProviderPlugin>;
export type PluginMediaUnderstandingProviderRegistration =
  PluginOwnedProviderRegistration<MediaUnderstandingProviderPlugin>;
export type PluginImageGenerationProviderRegistration =
  PluginOwnedProviderRegistration<ImageGenerationProviderPlugin>;
export type PluginVideoGenerationProviderRegistration =
  PluginOwnedProviderRegistration<VideoGenerationProviderPlugin>;
export type PluginMusicGenerationProviderRegistration =
  PluginOwnedProviderRegistration<MusicGenerationProviderPlugin>;
export type PluginRealtimeTranscriptionProviderRegistration =
  PluginOwnedProviderRegistration<RealtimeTranscriptionProviderPlugin>;
export type PluginRealtimeVoiceProviderRegistration =
  PluginOwnedProviderRegistration<RealtimeVoiceProviderPlugin>;
export type PluginWebSearchProviderRegistration =
  PluginOwnedProviderRegistration<WebSearchProviderPlugin>;
export type PluginWebFetchProviderRegistration =
  PluginOwnedProviderRegistration<WebFetchProviderPlugin>;
export type PluginMigrationProviderRegistration =
  PluginOwnedProviderRegistration<MigrationProviderPlugin>;

export type PluginHookRegistration = {
  pluginId: string;
  entry: HookEntry;
  events: string[];
  source: string;
  rootDir?: string;
};

export type PluginServiceRegistration = {
  pluginId: string;
  pluginName?: string;
  service: CoreBlowPluginService;
  source: string;
  rootDir?: string;
};

export type PluginCommandRegistration = {
  pluginId: string;
  pluginName?: string;
  command: CoreBlowPluginCommandDefinition;
  source: string;
  rootDir?: string;
};

export type PluginNodeHostCommandRegistration = {
  pluginId: string;
  pluginName?: string;
  command: CoreBlowPluginNodeHostCommand;
  source: string;
  rootDir?: string;
};

export type PluginNodeInvokePolicyRegistration = {
  pluginId: string;
  pluginName?: string;
  policy: CoreBlowPluginNodeInvokePolicy;
  pluginConfig?: Record<string, unknown>;
  source: string;
  rootDir?: string;
};

export type PluginConversationBindingResolvedHandlerRegistration = {
  pluginId: string;
  pluginName?: string;
  pluginRoot?: string;
  handler: (event: PluginConversationBindingResolvedEvent) => void | Promise<void>;
  source: string;
  rootDir?: string;
};

import type { PluginManifestContracts } from "./manifest.js";

export type PluginRecord = {
  id: string;
  name: string;
  version?: string;
  packageName?: string;
  description?: string;
  format?: PluginFormat;
  bundleFormat?: PluginBundleFormat;
  bundleCapabilities?: string[];
  kind?: PluginKind;
  source: string;
  rootDir?: string;
  origin: PluginOrigin;
  workspaceDir?: string;
  trustedOfficialInstall?: boolean;
  enabled: boolean;
  explicitlyEnabled?: boolean;
  activated?: boolean;
  activationSource?: string;
  activationReason?: string;
  compat?: readonly string[];
  status: "loaded" | "disabled" | "error";
  error?: string;
  failedAt?: Date;
  failurePhase?: "validation" | "load" | "register";
  toolNames: string[];
  hookNames: string[];
  channelIds: string[];
  cliBackendIds: string[];
  providerIds: string[];
  syntheticAuthRefs?: string[];
  speechProviderIds: string[];
  mediaUnderstandingProviderIds: string[];
  imageGenerationProviderIds: string[];
  videoGenerationProviderIds: string[];
  musicGenerationProviderIds?: string[];
  realtimeTranscriptionProviderIds?: string[];
  realtimeVoiceProviderIds?: string[];
  webFetchProviderIds?: string[];
  webSearchProviderIds: string[];
  migrationProviderIds?: string[];
  contextEngineIds?: string[];
  memoryEmbeddingProviderIds?: string[];
  agentHarnessIds?: string[];
  gatewayDiscoveryServiceIds?: string[];
  gatewayMethods: string[];
  cliCommands: string[];
  services: string[];
  commands: string[];
  httpRoutes: number;
  hookCount: number;
  configSchema: boolean;
  configUiHints?: Record<string, PluginConfigUiHint>;
  configJsonSchema?: Record<string, unknown>;
  contracts?: PluginManifestContracts;
};

import type { PluginTextTransforms } from "./cli-backend.types.js";

function isOfficialCodexPluginRecord(
  record: Pick<PluginRecord, "id" | "origin" | "packageName" | "rootDir" | "source">,
): boolean {
  if (record.id !== "codex") {
    return false;
  }
  if (record.origin !== "global") {
    return false;
  }
  if (
    record.packageName === "@coreblow/codex" ||
    record.packageName === "@openclaw/codex"
  ) {
    return true;
  }
  const sourcePath = path
    .normalize(record.rootDir ?? record.source)
    .split(path.sep)
    .join("/");
  return (
    sourcePath.includes("/node_modules/@coreblow/codex") ||
    sourcePath.includes("/node_modules/@openclaw/codex")
  );
}

function canClaimReservedCommandOwnership(
  record: Pick<PluginRecord, "id" | "origin" | "packageName" | "rootDir" | "source">,
): boolean {
  return record.origin === "bundled" || isOfficialCodexPluginRecord(record);
}

export type PluginTextTransformsRegistration = {
  pluginId: string;
  transforms: PluginTextTransforms;
};

export type PluginSessionExtensionRegistryRegistration = {
  pluginId: string;
  pluginName?: string;
  extension: PluginSessionExtensionRegistration;
  source: string;
  rootDir?: string;
};

export type PluginTrustedToolPolicyRegistryRegistration = {
  pluginId: string;
  pluginName?: string;
  policy: PluginTrustedToolPolicyRegistration;
  source: string;
  rootDir?: string;
};

export type PluginToolMetadataRegistryRegistration = {
  pluginId: string;
  pluginName?: string;
  metadata: PluginToolMetadataRegistration;
  source: string;
  rootDir?: string;
};

export type PluginControlUiDescriptorRegistryRegistration = {
  pluginId: string;
  pluginName?: string;
  descriptor: PluginControlUiDescriptor;
  source: string;
  rootDir?: string;
};

export type PluginRuntimeLifecycleRegistryRegistration = {
  pluginId: string;
  pluginName?: string;
  lifecycle: PluginRuntimeLifecycleRegistration;
  source: string;
  rootDir?: string;
};

export type PluginAgentEventSubscriptionRegistryRegistration = {
  pluginId: string;
  pluginName?: string;
  subscription: PluginAgentEventSubscriptionRegistration;
  source: string;
  rootDir?: string;
};

export type PluginCodexAppServerExtensionFactoryRegistration = {
  pluginId: string;
  pluginName?: string;
  factory: CodexAppServerExtensionFactory;
  source?: string;
};

export type PluginMemoryEmbeddingProviderRegistration = {
  pluginId: string;
  pluginName?: string;
  provider: MemoryEmbeddingProviderAdapter;
  source?: string;
  rootDir?: string;
};

export type PluginSessionSchedulerJobRegistryRegistration = {
  pluginId: string;
  pluginName?: string;
  job: PluginSessionSchedulerJobRegistration;
  generation?: number;
  source: string;
  rootDir?: string;
};

export type PluginSessionActionRegistryRegistration = {
  pluginId: string;
  pluginName?: string;
  action: PluginSessionActionRegistration;
  source: string;
  rootDir?: string;
};

export type PluginRegistry = {
  plugins: PluginRecord[];
  tools: PluginToolRegistration[];
  agentToolResultMiddlewares: PluginAgentToolResultMiddlewareRegistration[];
  hooks: PluginHookRegistration[];
  typedHooks: TypedPluginHookRegistration[];
  channels: PluginChannelRegistration[];
  channelSetups: PluginChannelSetupRegistration[];
  providers: PluginProviderRegistration[];
  modelCatalogProviders?: PluginModelCatalogProviderRegistration[];
  cliBackends?: PluginCliBackendRegistration[];
  speechProviders: PluginSpeechProviderRegistration[];
  mediaUnderstandingProviders: PluginMediaUnderstandingProviderRegistration[];
  imageGenerationProviders: PluginImageGenerationProviderRegistration[];
  videoGenerationProviders: PluginVideoGenerationProviderRegistration[];
  musicGenerationProviders?: PluginMusicGenerationProviderRegistration[];
  realtimeTranscriptionProviders?: PluginRealtimeTranscriptionProviderRegistration[];
  realtimeVoiceProviders?: PluginRealtimeVoiceProviderRegistration[];
  webSearchProviders: PluginWebSearchProviderRegistration[];
  webFetchProviders?: PluginWebFetchProviderRegistration[];
  migrationProviders?: PluginMigrationProviderRegistration[];
  codexAppServerExtensionFactories?: PluginCodexAppServerExtensionFactoryRegistration[];
  memoryEmbeddingProviders?: PluginMemoryEmbeddingProviderRegistration[];
  textTransforms?: PluginTextTransformsRegistration[];
  gatewayHandlers: GatewayRequestHandlers;
  gatewayMethodDescriptors?: GatewayMethodDescriptor[];
  gatewayMethodScopes?: Partial<Record<string, OperatorScope>>;
  httpRoutes: PluginHttpRouteRegistration[];
  cliRegistrars: PluginCliRegistration[];
  services: PluginServiceRegistration[];
  commands: PluginCommandRegistration[];
  nodeHostCommands?: PluginNodeHostCommandRegistration[];
  nodeInvokePolicies?: PluginNodeInvokePolicyRegistration[];
  conversationBindingResolvedHandlers: PluginConversationBindingResolvedHandlerRegistration[];
  sessionExtensions?: PluginSessionExtensionRegistryRegistration[];
  trustedToolPolicies?: PluginTrustedToolPolicyRegistryRegistration[];
  toolMetadata?: PluginToolMetadataRegistryRegistration[];
  controlUiDescriptors?: PluginControlUiDescriptorRegistryRegistration[];
  runtimeLifecycles?: PluginRuntimeLifecycleRegistryRegistration[];
  agentEventSubscriptions?: PluginAgentEventSubscriptionRegistryRegistration[];
  sessionSchedulerJobs?: PluginSessionSchedulerJobRegistryRegistration[];
  sessionActions?: PluginSessionActionRegistryRegistration[];
  diagnostics: PluginDiagnostic[];
};

export type PluginRegistryParams = {
  logger: PluginLogger;
  coreGatewayHandlers?: GatewayRequestHandlers;
  runtime: PluginRuntime;
  hostServices?: {
    /** May be a live accessor; plugin APIs must read it at call time. */
    cron?: import("../cron/service-contract.js").CronServiceContract;
  };
  activateGlobalSideEffects?: boolean;
  // When true, skip writing to the global plugin command registry during register().
  // Used by non-activating snapshot loads to avoid leaking commands into the running gateway.
  suppressGlobalCommands?: boolean;
};

type PluginTypedHookPolicy = {
  allowPromptInjection?: boolean;
};

const constrainLegacyPromptInjectionHook = (
  handler: PluginHookHandlerMap["before_agent_start"],
): PluginHookHandlerMap["before_agent_start"] => {
  return (event, ctx) => {
    const result = handler(event, ctx);
    if (result && typeof result === "object" && "then" in result) {
      return Promise.resolve(result).then((resolved) =>
        stripPromptMutationFieldsFromLegacyHookResult(resolved),
      );
    }
    return stripPromptMutationFieldsFromLegacyHookResult(result);
  };
};

export { createEmptyPluginRegistry } from "./registry-empty.js";

export function createPluginRegistry(registryParams: PluginRegistryParams) {
  const registry = createEmptyPluginRegistry();
  const coreGatewayMethods = new Set(Object.keys(registryParams.coreGatewayHandlers ?? {}));

  const pushDiagnostic = (diag: PluginDiagnostic) => {
    registry.diagnostics.push(diag);
  };

  const registerTool = (
    record: PluginRecord,
    tool: AnyAgentTool | CoreBlowPluginToolFactory,
    opts?: { name?: string; names?: string[]; optional?: boolean },
  ) => {
    const names = opts?.names ?? (opts?.name ? [opts.name] : []);
    const optional = opts?.optional === true;
    const factory: CoreBlowPluginToolFactory =
      typeof tool === "function" ? tool : (_ctx: CoreBlowPluginToolContext) => tool;

    if (typeof tool !== "function") {
      names.push(tool.name);
    }

    const normalized = names.map((name) => name.trim()).filter(Boolean);
    if (normalized.length > 0) {
      record.toolNames.push(...normalized);
    }
    registry.tools.push({
      pluginId: record.id,
      pluginName: record.name,
      factory,
      names: normalized,
      optional,
      source: record.source,
      rootDir: record.rootDir,
    });
  };

  const registerHook = (
    record: PluginRecord,
    events: string | string[],
    handler: Parameters<typeof registerInternalHook>[1],
    opts: CoreBlowPluginHookOptions | undefined,
    config: CoreBlowPluginApi["config"],
  ) => {
    const eventList = Array.isArray(events) ? events : [events];
    const normalizedEvents = eventList.map((event) => event.trim()).filter(Boolean);
    const entry = opts?.entry ?? null;
    const name = entry?.hook.name ?? opts?.name?.trim();
    if (!name) {
      pushDiagnostic({
        level: "warn",
        pluginId: record.id,
        source: record.source,
        message: "hook registration missing name",
      });
      return;
    }
    const existingHook = registry.hooks.find((entry) => entry.entry.hook.name === name);
    if (existingHook) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `hook already registered: ${name} (${existingHook.pluginId})`,
      });
      return;
    }

    const description = entry?.hook.description ?? opts?.description ?? "";
    const hookEntry: HookEntry = entry
      ? {
          ...entry,
          hook: {
            ...entry.hook,
            name,
            description,
            source: "coreblow-plugin",
            pluginId: record.id,
          },
          metadata: {
            ...entry.metadata,
            events: normalizedEvents,
          },
        }
      : {
          hook: {
            name,
            description,
            source: "coreblow-plugin",
            pluginId: record.id,
            filePath: record.source,
            baseDir: path.dirname(record.source),
            handlerPath: record.source,
          },
          frontmatter: {},
          metadata: { events: normalizedEvents },
          invocation: { enabled: true },
        };

    record.hookNames.push(name);
    registry.hooks.push({
      pluginId: record.id,
      entry: hookEntry,
      events: normalizedEvents,
      source: record.source,
    });

    const hookSystemEnabled = config?.hooks?.internal?.enabled === true;
    if (!hookSystemEnabled || opts?.register === false) {
      return;
    }

    for (const event of normalizedEvents) {
      registerInternalHook(event, handler);
    }
  };

  const registerGatewayMethod = (
    record: PluginRecord,
    method: string,
    handler: GatewayRequestHandler,
    opts?: { scope?: OperatorScope },
  ) => {
    const trimmed = method.trim();
    if (!trimmed) {
      return;
    }
    if (coreGatewayMethods.has(trimmed) || registry.gatewayHandlers[trimmed]) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `gateway method already registered: ${trimmed}`,
      });
      return;
    }
    registry.gatewayHandlers[trimmed] = handler;
    if (opts?.scope) {
      registry.gatewayMethodScopes ??= {};
      registry.gatewayMethodScopes[trimmed] = opts.scope;
    }
    record.gatewayMethods.push(trimmed);
  };

  const registerAgentToolResultMiddleware = (
    record: PluginRecord,
    middleware: AgentToolResultMiddleware,
    opts?: { runtimes?: readonly AgentToolResultMiddlewareRuntime[] },
  ) => {
    const runtimes: readonly AgentToolResultMiddlewareRuntime[] = opts?.runtimes?.length
      ? [...opts.runtimes]
      : ["pi", "codex"];
    registry.agentToolResultMiddlewares.push({
      pluginId: record.id,
      pluginName: record.name,
      middleware,
      runtimes,
      source: record.source,
      rootDir: record.rootDir,
    });
  };

  const registerNodeHostCommand = (
    record: PluginRecord,
    nodeCommand: CoreBlowPluginNodeHostCommand,
  ) => {
    const command = nodeCommand.command.trim();
    const reserved = new Set<string>([
      ...NODE_SYSTEM_RUN_COMMANDS,
      ...NODE_EXEC_APPROVALS_COMMANDS,
      NODE_SYSTEM_NOTIFY_COMMAND,
    ]);
    if (!command) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: "node host command registration missing command",
      });
      return;
    }
    if (reserved.has(command)) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `node host command reserved by core: ${command}`,
      });
      return;
    }
    registry.nodeHostCommands ??= [];
    const existing = registry.nodeHostCommands.find((entry) => entry.command.command === command);
    if (existing) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `node host command already registered: ${command} (${existing.pluginId})`,
      });
      return;
    }
    registry.nodeHostCommands.push({
      pluginId: record.id,
      pluginName: record.name,
      command: { ...nodeCommand, command, cap: nodeCommand.cap?.trim() || undefined },
      source: record.source,
      rootDir: record.rootDir,
    });
  };

  const registerNodeInvokePolicy = (
    record: PluginRecord,
    policy: CoreBlowPluginNodeInvokePolicy,
    pluginConfig?: Record<string, unknown>,
  ) => {
    const commands = policy.commands.map((command) => command.trim()).filter(Boolean);
    if (commands.length === 0 || typeof policy.handle !== "function") {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: "node invoke policy registration requires commands and a handler",
      });
      return;
    }
    registry.nodeInvokePolicies ??= [];
    for (const command of commands) {
      const existing = registry.nodeInvokePolicies.find((entry) =>
        entry.policy.commands.includes(command),
      );
      if (existing) {
        pushDiagnostic({
          level: "error",
          pluginId: record.id,
          source: record.source,
          message: `node invoke policy already registered for ${command} (${existing.pluginId})`,
        });
        return;
      }
    }
    registry.nodeInvokePolicies.push({
      pluginId: record.id,
      pluginName: record.name,
      policy: { ...policy, commands },
      pluginConfig,
      source: record.source,
      rootDir: record.rootDir,
    });
  };

  const describeHttpRouteOwner = (entry: PluginHttpRouteRegistration): string => {
    const plugin = entry.pluginId?.trim() || "unknown-plugin";
    const source = entry.source?.trim() || "unknown-source";
    return `${plugin} (${source})`;
  };

  const registerHttpRoute = (record: PluginRecord, params: CoreBlowPluginHttpRouteParams) => {
    const normalizedPath = normalizePluginHttpPath(params.path);
    if (!normalizedPath) {
      pushDiagnostic({
        level: "warn",
        pluginId: record.id,
        source: record.source,
        message: "http route registration missing path",
      });
      return;
    }
    if (params.auth !== "gateway" && params.auth !== "plugin") {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `http route registration missing or invalid auth: ${normalizedPath}`,
      });
      return;
    }
    const match = params.match ?? "exact";
    const overlappingRoute = findOverlappingPluginHttpRoute(registry.httpRoutes, {
      path: normalizedPath,
      match,
    });
    if (overlappingRoute && overlappingRoute.auth !== params.auth) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message:
          `http route overlap rejected: ${normalizedPath} (${match}, ${params.auth}) ` +
          `overlaps ${overlappingRoute.path} (${overlappingRoute.match}, ${overlappingRoute.auth}) ` +
          `owned by ${describeHttpRouteOwner(overlappingRoute)}`,
      });
      return;
    }
    const existingIndex = registry.httpRoutes.findIndex(
      (entry) => entry.path === normalizedPath && entry.match === match,
    );
    if (existingIndex >= 0) {
      const existing = registry.httpRoutes[existingIndex];
      if (!existing) {
        return;
      }
      if (!params.replaceExisting) {
        pushDiagnostic({
          level: "error",
          pluginId: record.id,
          source: record.source,
          message: `http route already registered: ${normalizedPath} (${match}) by ${describeHttpRouteOwner(existing)}`,
        });
        return;
      }
      if (existing.pluginId && existing.pluginId !== record.id) {
        pushDiagnostic({
          level: "error",
          pluginId: record.id,
          source: record.source,
          message: `http route replacement rejected: ${normalizedPath} (${match}) owned by ${describeHttpRouteOwner(existing)}`,
        });
        return;
      }
      registry.httpRoutes[existingIndex] = {
        pluginId: record.id,
        path: normalizedPath,
        handler: params.handler,
        auth: params.auth,
        match,
        source: record.source,
      };
      return;
    }
    record.httpRoutes += 1;
    registry.httpRoutes.push({
      pluginId: record.id,
      path: normalizedPath,
      handler: params.handler,
      auth: params.auth,
      match,
      source: record.source,
    });
  };

  const registerChannel = (
    record: PluginRecord,
    registration: CoreBlowPluginChannelRegistration | ChannelPlugin,
    mode: PluginRegistrationMode = "full",
  ) => {
    const normalized =
      typeof (registration as CoreBlowPluginChannelRegistration).plugin === "object"
        ? (registration as CoreBlowPluginChannelRegistration)
        : { plugin: registration as ChannelPlugin };
    const plugin = normalized.plugin;
    const id = typeof plugin?.id === "string" ? plugin.id.trim() : String(plugin?.id ?? "").trim();
    if (!id) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: "channel registration missing id",
      });
      return;
    }
    const existingRuntime = registry.channels.find((entry) => entry.plugin.id === id);
    if (mode !== "setup-only" && existingRuntime) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `channel already registered: ${id} (${existingRuntime.pluginId})`,
      });
      return;
    }
    const existingSetup = registry.channelSetups.find((entry) => entry.plugin.id === id);
    if (existingSetup) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `channel setup already registered: ${id} (${existingSetup.pluginId})`,
      });
      return;
    }
    record.channelIds.push(id);
    registry.channelSetups.push({
      pluginId: record.id,
      pluginName: record.name,
      plugin,
      source: record.source,
      enabled: record.enabled,
      rootDir: record.rootDir,
    });
    if (mode === "setup-only") {
      return;
    }
    registry.channels.push({
      pluginId: record.id,
      pluginName: record.name,
      plugin,
      source: record.source,
      rootDir: record.rootDir,
    });
  };

  const registerProvider = (record: PluginRecord, provider: ProviderPlugin) => {
    const normalizedProvider = normalizeRegisteredProvider({
      pluginId: record.id,
      source: record.source,
      provider,
      pushDiagnostic,
    });
    if (!normalizedProvider) {
      return;
    }
    const id = normalizedProvider.id;
    const existing = registry.providers.find((entry) => entry.provider.id === id);
    if (existing) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `provider already registered: ${id} (${existing.pluginId})`,
      });
      return;
    }
    record.providerIds.push(id);
    registry.providers.push({
      pluginId: record.id,
      pluginName: record.name,
      provider: normalizedProvider,
      source: record.source,
      rootDir: record.rootDir,
    });
  };

  const registerCliBackend = (record: PluginRecord, backend: CliBackendPlugin) => {
    const id = backend.id.trim();
    if (!id) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: "cli backend registration missing id",
      });
      return;
    }
    const existing = (registry.cliBackends ?? []).find((entry) => entry.backend.id === id);
    if (existing) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `cli backend already registered: ${id} (${existing.pluginId})`,
      });
      return;
    }
    (registry.cliBackends ??= []).push({
      pluginId: record.id,
      pluginName: record.name,
      backend: {
        ...backend,
        id,
      },
      source: record.source,
      rootDir: record.rootDir,
    });
    record.cliBackendIds.push(id);
  };

  const registerUniqueProviderLike = <
    T extends { id: string },
    R extends PluginOwnedProviderRegistration<T>,
  >(params: {
    record: PluginRecord;
    provider: T;
    kindLabel: string;
    registrations: R[];
    ownedIds: string[];
  }) => {
    const id = params.provider.id.trim();
    const { record, kindLabel } = params;
    const missingLabel = `${kindLabel} registration missing id`;
    const duplicateLabel = `${kindLabel} already registered: ${id}`;
    if (!id) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: missingLabel,
      });
      return;
    }
    const existing = params.registrations.find((entry) => entry.provider.id === id);
    if (existing) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `${duplicateLabel} (${existing.pluginId})`,
      });
      return;
    }
    params.ownedIds.push(id);
    params.registrations.push({
      pluginId: record.id,
      pluginName: record.name,
      provider: params.provider,
      source: record.source,
      rootDir: record.rootDir,
    } as R);
  };

  const registerSpeechProvider = (record: PluginRecord, provider: SpeechProviderPlugin) => {
    registerUniqueProviderLike({
      record,
      provider,
      kindLabel: "speech provider",
      registrations: registry.speechProviders,
      ownedIds: record.speechProviderIds,
    });
  };

  const registerMediaUnderstandingProvider = (
    record: PluginRecord,
    provider: MediaUnderstandingProviderPlugin,
  ) => {
    registerUniqueProviderLike({
      record,
      provider,
      kindLabel: "media provider",
      registrations: registry.mediaUnderstandingProviders,
      ownedIds: record.mediaUnderstandingProviderIds,
    });
  };

  const registerImageGenerationProvider = (
    record: PluginRecord,
    provider: ImageGenerationProviderPlugin,
  ) => {
    registerUniqueProviderLike({
      record,
      provider,
      kindLabel: "image-generation provider",
      registrations: registry.imageGenerationProviders,
      ownedIds: record.imageGenerationProviderIds,
    });
  };

  const registerVideoGenerationProvider = (
    record: PluginRecord,
    provider: VideoGenerationProviderPlugin,
  ) => {
    registerUniqueProviderLike({
      record,
      provider,
      kindLabel: "video-generation provider",
      registrations: registry.videoGenerationProviders,
      ownedIds: record.videoGenerationProviderIds,
    });
  };

  const registerMusicGenerationProvider = (
    record: PluginRecord,
    provider: MusicGenerationProviderPlugin,
  ) => {
    registerUniqueProviderLike({
      record,
      provider,
      kindLabel: "music-generation provider",
      registrations: (registry.musicGenerationProviders ??= []),
      ownedIds: (record.musicGenerationProviderIds ??= []),
    });
  };

  const registerRealtimeTranscriptionProvider = (
    record: PluginRecord,
    provider: RealtimeTranscriptionProviderPlugin,
  ) => {
    registerUniqueProviderLike({
      record,
      provider,
      kindLabel: "realtime-transcription provider",
      registrations: (registry.realtimeTranscriptionProviders ??= []),
      ownedIds: (record.realtimeTranscriptionProviderIds ??= []),
    });
  };

  const registerRealtimeVoiceProvider = (
    record: PluginRecord,
    provider: RealtimeVoiceProviderPlugin,
  ) => {
    registerUniqueProviderLike({
      record,
      provider,
      kindLabel: "realtime voice provider",
      registrations: (registry.realtimeVoiceProviders ??= []),
      ownedIds: (record.realtimeVoiceProviderIds ??= []),
    });
  };

  const registerWebSearchProvider = (record: PluginRecord, provider: WebSearchProviderPlugin) => {
    registerUniqueProviderLike({
      record,
      provider,
      kindLabel: "web search provider",
      registrations: registry.webSearchProviders,
      ownedIds: record.webSearchProviderIds,
    });
  };

  const registerMigrationProvider = (record: PluginRecord, provider: MigrationProviderPlugin) => {
    registerUniqueProviderLike({
      record,
      provider,
      kindLabel: "migration provider",
      registrations: (registry.migrationProviders ??= []),
      ownedIds: (record.migrationProviderIds ??= []),
    });
  };

  const registerCli = (
    record: PluginRecord,
    registrar: CoreBlowPluginCliRegistrar,
    opts?: { commands?: string[]; descriptors?: CoreBlowPluginCliCommandDescriptor[] },
  ) => {
    const descriptors = (opts?.descriptors ?? [])
      .map((descriptor) => ({
        name: descriptor.name.trim(),
        description: descriptor.description.trim(),
        hasSubcommands: descriptor.hasSubcommands,
      }))
      .filter((descriptor) => descriptor.name && descriptor.description);
    const commands = [
      ...(opts?.commands ?? []),
      ...descriptors.map((descriptor) => descriptor.name),
    ]
      .map((cmd) => cmd.trim())
      .filter(Boolean);
    if (commands.length === 0) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: "cli registration missing explicit commands metadata",
      });
      return;
    }
    const existing = registry.cliRegistrars.find((entry) =>
      entry.commands.some((command) => commands.includes(command)),
    );
    if (existing) {
      const overlap = commands.find((command) => existing.commands.includes(command));
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `cli command already registered: ${overlap ?? commands[0]} (${existing.pluginId})`,
      });
      return;
    }
    record.cliCommands.push(...commands);
    registry.cliRegistrars.push({
      pluginId: record.id,
      pluginName: record.name,
      register: registrar,
      commands,
      descriptors,
      source: record.source,
      rootDir: record.rootDir,
    });
  };

  const registerService = (record: PluginRecord, service: CoreBlowPluginService) => {
    const id = service.id.trim();
    if (!id) {
      return;
    }
    const existing = registry.services.find((entry) => entry.service.id === id);
    if (existing) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `service already registered: ${id} (${existing.pluginId})`,
      });
      return;
    }
    record.services.push(id);
    registry.services.push({
      pluginId: record.id,
      pluginName: record.name,
      service,
      source: record.source,
      rootDir: record.rootDir,
    });
  };

  const registerCommand = (record: PluginRecord, command: CoreBlowPluginCommandDefinition) => {
    const name = command.name.trim();
    if (!name) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: "command registration missing name",
      });
      return;
    }
    const allowReservedCommandNames = command.ownership === "reserved";
    if (allowReservedCommandNames && !canClaimReservedCommandOwnership(record)) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `only bundled plugins can claim reserved command ownership: ${name}`,
      });
      return;
    }
    if (allowReservedCommandNames && !isReservedCommandName(name)) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `reserved command ownership requires a reserved command name: ${name}`,
      });
      return;
    }
    if (allowReservedCommandNames && record.id !== name.toLowerCase()) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `command registration failed: Reserved command ownership requires plugin id "${record.id}" to match reserved command name "${name.toLowerCase()}"`,
      });
      return;
    }

    // For snapshot (non-activating) loads, record the command locally without touching the
    // global plugin command registry so running gateway commands stay intact.
    // We still validate the command definition so diagnostics match the real activation path.
    // NOTE: cross-plugin duplicate command detection is intentionally skipped here because
    // snapshot registries are isolated and never write to the global command table. Conflicts
    // will surface when the plugin is loaded via the normal activation path at gateway startup.
    if (registryParams.suppressGlobalCommands) {
      const validationError = validatePluginCommandDefinition(command, {
        allowReservedCommandNames,
      });
      if (validationError) {
        pushDiagnostic({
          level: "error",
          pluginId: record.id,
          source: record.source,
          message: `command registration failed: ${validationError}`,
        });
        return;
      }
    } else {
      const { ownership: _ownership, ...commandForRegistration } = command;
      void _ownership;
      const result = registerPluginCommand(
        record.id,
        allowReservedCommandNames ? commandForRegistration : command,
        {
          pluginName: record.name,
          pluginRoot: record.rootDir,
          allowReservedCommandNames,
        },
      );
      if (!result.ok) {
        pushDiagnostic({
          level: "error",
          pluginId: record.id,
          source: record.source,
          message: `command registration failed: ${result.error}`,
        });
        return;
      }
      if (allowReservedCommandNames) {
        const registeredCommand = pluginCommands.get(`/${name.toLowerCase()}`);
        if (registeredCommand?.pluginId === record.id) {
          registeredCommand.ownership = "reserved";
        }
      }
    }

    record.commands.push(name);
    registry.commands.push({
      pluginId: record.id,
      pluginName: record.name,
      command,
      source: record.source,
      rootDir: record.rootDir,
    });
  };

  const registerTypedHook = <K extends PluginHookName>(
    record: PluginRecord,
    hookName: K,
    handler: PluginHookHandlerMap[K],
    opts?: { priority?: number },
    policy?: PluginTypedHookPolicy,
  ) => {
    if (!isPluginHookName(hookName)) {
      pushDiagnostic({
        level: "warn",
        pluginId: record.id,
        source: record.source,
        message: `unknown typed hook "${String(hookName)}" ignored`,
      });
      return;
    }
    let effectiveHandler = handler;
    if (policy?.allowPromptInjection === false && isPromptInjectionHookName(hookName)) {
      if (hookName === "before_prompt_build") {
        pushDiagnostic({
          level: "warn",
          pluginId: record.id,
          source: record.source,
          message: `typed hook "${hookName}" blocked by plugins.entries.${record.id}.hooks.allowPromptInjection=false`,
        });
        return;
      }
      if (hookName === "before_agent_start") {
        pushDiagnostic({
          level: "warn",
          pluginId: record.id,
          source: record.source,
          message: `typed hook "${hookName}" prompt fields constrained by plugins.entries.${record.id}.hooks.allowPromptInjection=false`,
        });
        effectiveHandler = constrainLegacyPromptInjectionHook(
          handler as PluginHookHandlerMap["before_agent_start"],
        ) as PluginHookHandlerMap[K];
      }
    }
    record.hookCount += 1;
    registry.typedHooks.push({
      pluginId: record.id,
      hookName,
      handler: effectiveHandler,
      priority: opts?.priority,
      source: record.source,
    } as TypedPluginHookRegistration);
  };

  const registerConversationBindingResolvedHandler = (
    record: PluginRecord,
    handler: (event: PluginConversationBindingResolvedEvent) => void | Promise<void>,
  ) => {
    registry.conversationBindingResolvedHandlers.push({
      pluginId: record.id,
      pluginName: record.name,
      pluginRoot: record.rootDir,
      handler,
      source: record.source,
      rootDir: record.rootDir,
    });
  };

  const normalizeHostHookString = (value: unknown): string =>
    typeof value === "string" ? normalizePluginHostHookId(value) : "";

  const normalizeOptionalHostHookString = (value: unknown): string | undefined => {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== "string") {
      return "";
    }
    return value.trim();
  };

  const normalizeHostHookStringList = (value: unknown): string[] | undefined | null => {
    if (value === undefined) {
      return undefined;
    }
    if (!Array.isArray(value)) {
      return null;
    }
    const normalized = value.map((item) => normalizeOptionalHostHookString(item));
    if (normalized.some((item) => !item)) {
      return null;
    }
    return normalized as string[];
  };

  const validateSessionActionSchema = (
    record: PluginRecord,
    id: string,
    schema: unknown,
  ): boolean => {
    if (schema === undefined) {
      return true;
    }
    if (!isPluginJsonValue(schema)) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `session action schema must be JSON-compatible: ${id}`,
      });
      return false;
    }
    if (
      typeof schema !== "boolean" &&
      (!schema || typeof schema !== "object" || Array.isArray(schema))
    ) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `session action schema must be a JSON schema object or boolean: ${id}`,
      });
      return false;
    }
    try {
      validateJsonSchemaValue({
        schema: schema as Record<string, unknown>,
        cacheKey: `plugin-session-action-registration:${record.id}:${id}`,
        value: undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `session action schema is not valid JSON Schema: ${id}: ${message}`,
      });
      return false;
    }
    return true;
  };

  const controlUiSurfaces = new Set<PluginControlUiDescriptor["surface"]>([
    "session",
    "tool",
    "run",
    "settings",
  ]);

  const registerSessionExtension = (
    record: PluginRecord,
    extension: PluginSessionExtensionRegistration,
  ) => {
    const namespace = normalizeHostHookString(extension.namespace);
    const description = normalizeHostHookString(extension.description);
    const project = extension.project;
    let normalizedSessionEntrySlotKey: string | undefined;
    let invalidMessage: string | undefined;
    if (!namespace || !description) {
      invalidMessage = "session extension registration requires namespace and description";
    } else if (project !== undefined && typeof project !== "function") {
      invalidMessage = "session extension projector must be a function";
    } else if (project?.constructor?.name === "AsyncFunction") {
      invalidMessage = "session extension projector must be synchronous";
    } else if (extension.cleanup !== undefined && typeof extension.cleanup !== "function") {
      invalidMessage = "session extension cleanup must be a function";
    } else if (extension.sessionEntrySlotKey !== undefined) {
      const slotKey = normalizeSessionEntrySlotKey(extension.sessionEntrySlotKey);
      if (!slotKey.ok) {
        invalidMessage = slotKey.error;
      } else {
        normalizedSessionEntrySlotKey = slotKey.key;
      }
    }
    if (invalidMessage) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: invalidMessage,
      });
      return;
    }
    const existing = (registry.sessionExtensions ?? []).find(
      (entry) => entry.pluginId === record.id && entry.extension.namespace === namespace,
    );
    if (existing) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `session extension already registered: ${namespace}`,
      });
      return;
    }
    if (normalizedSessionEntrySlotKey) {
      const existingSlot = (registry.sessionExtensions ?? []).find((entry) => {
        const existingSlotKey = entry.extension.sessionEntrySlotKey;
        if (existingSlotKey === undefined) {
          return false;
        }
        const normalizedExistingSlotKey = normalizeSessionEntrySlotKey(existingSlotKey);
        return (
          normalizedExistingSlotKey.ok &&
          normalizedExistingSlotKey.key === normalizedSessionEntrySlotKey
        );
      });
      if (existingSlot) {
        pushDiagnostic({
          level: "error",
          pluginId: record.id,
          source: record.source,
          message: `sessionEntrySlotKey already registered: ${normalizedSessionEntrySlotKey}`,
        });
        return;
      }
    }
    (registry.sessionExtensions ??= []).push({
      pluginId: record.id,
      pluginName: record.name,
      extension: {
        ...extension,
        namespace,
        description,
        ...(normalizedSessionEntrySlotKey
          ? { sessionEntrySlotKey: normalizedSessionEntrySlotKey }
          : {}),
      },
      source: record.source,
      rootDir: record.rootDir,
    });
  };

  const registerTrustedToolPolicy = (
    record: PluginRecord,
    policy: PluginTrustedToolPolicyRegistration,
  ) => {
    if (record.origin !== "bundled") {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: "only bundled plugins can register trusted tool policies",
      });
      return;
    }
    const id = normalizeHostHookString(policy.id);
    const description = normalizeHostHookString(policy.description);
    if (!id || !description || typeof policy.evaluate !== "function") {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: "trusted tool policy registration requires id, description, and evaluate()",
      });
      return;
    }
    const existing = (registry.trustedToolPolicies ?? []).find((entry) => entry.policy.id === id);
    if (existing) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `trusted tool policy already registered: ${id} (${existing.pluginId})`,
      });
      return;
    }
    (registry.trustedToolPolicies ??= []).push({
      pluginId: record.id,
      pluginName: record.name,
      policy: {
        ...policy,
        id,
        description,
      },
      source: record.source,
      rootDir: record.rootDir,
    });
  };

  const registerToolMetadata = (record: PluginRecord, metadata: PluginToolMetadataRegistration) => {
    const toolName = normalizeHostHookString(metadata.toolName);
    if (!toolName) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: "tool metadata registration missing toolName",
      });
      return;
    }
    const declaredNames = normalizePluginToolContractNames(record.contracts);
    const undeclared = findUndeclaredPluginToolNames({
      declaredNames,
      toolNames: [toolName],
    });
    if (undeclared.length > 0) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `plugin must declare contracts.tools for tool metadata: ${undeclared.join(", ")}`,
      });
      return;
    }
    const existing = (registry.toolMetadata ?? []).find(
      (entry) => entry.pluginId === record.id && entry.metadata.toolName === toolName,
    );
    if (existing) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `tool metadata already registered: ${toolName} (${existing.pluginId})`,
      });
      return;
    }
    const displayName = normalizeOptionalHostHookString(metadata.displayName);
    const description = normalizeOptionalHostHookString(metadata.description);
    const tags = normalizeHostHookStringList(metadata.tags);
    if (
      displayName === "" ||
      description === "" ||
      tags === null ||
      (metadata.risk !== undefined && !["low", "medium", "high"].includes(metadata.risk))
    ) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `tool metadata registration has invalid metadata: ${toolName}`,
      });
      return;
    }
    (registry.toolMetadata ??= []).push({
      pluginId: record.id,
      pluginName: record.name,
      metadata: {
        ...metadata,
        toolName,
        ...(displayName !== undefined ? { displayName } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(tags !== undefined ? { tags } : {}),
      },
      source: record.source,
      rootDir: record.rootDir,
    });
  };

  const registerControlUiDescriptor = (
    record: PluginRecord,
    descriptor: PluginControlUiDescriptor,
  ) => {
    const id = normalizeHostHookString(descriptor.id);
    const label = normalizeHostHookString(descriptor.label);
    const description = normalizeOptionalHostHookString(descriptor.description);
    const placement = normalizeOptionalHostHookString(descriptor.placement);
    const requiredScopes = normalizeHostHookStringList(descriptor.requiredScopes);
    const surface = typeof descriptor.surface === "string" ? descriptor.surface : "";
    if (
      !id ||
      !label ||
      !controlUiSurfaces.has(surface as PluginControlUiDescriptor["surface"]) ||
      description === "" ||
      placement === "" ||
      requiredScopes === null
    ) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message:
          "control UI descriptor registration requires id, surface, label, and valid optional fields",
      });
      return;
    }
    if (requiredScopes !== undefined) {
      const unknownScope = requiredScopes.find((scope) => !isOperatorScope(scope));
      if (unknownScope !== undefined) {
        pushDiagnostic({
          level: "error",
          pluginId: record.id,
          source: record.source,
          message: `control UI descriptor requiredScopes contains unknown operator scope: ${unknownScope}`,
        });
        return;
      }
    }
    if (descriptor.schema !== undefined && !isPluginJsonValue(descriptor.schema)) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `control UI descriptor schema must be JSON-compatible: ${id}`,
      });
      return;
    }
    const existing = (registry.controlUiDescriptors ?? []).find(
      (entry) => entry.pluginId === record.id && entry.descriptor.id === id,
    );
    if (existing) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `control UI descriptor already registered: ${id}`,
      });
      return;
    }
    (registry.controlUiDescriptors ??= []).push({
      pluginId: record.id,
      pluginName: record.name,
      descriptor: {
        ...descriptor,
        id,
        surface: surface as PluginControlUiDescriptor["surface"],
        label,
        ...(description !== undefined ? { description } : {}),
        ...(placement !== undefined ? { placement } : {}),
        ...(requiredScopes !== undefined
          ? { requiredScopes: requiredScopes as OperatorScope[] }
          : {}),
      },
      source: record.source,
      rootDir: record.rootDir,
    });
  };

  const registerRuntimeLifecycle = (
    record: PluginRecord,
    lifecycle: PluginRuntimeLifecycleRegistration,
  ) => {
    const id = normalizePluginHostHookId(lifecycle.id);
    if (!id) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: "runtime lifecycle registration missing id",
      });
      return;
    }
    const existing = (registry.runtimeLifecycles ?? []).find(
      (entry) => entry.pluginId === record.id && entry.lifecycle.id === id,
    );
    if (existing) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `runtime lifecycle already registered: ${id}`,
      });
      return;
    }
    if (lifecycle.cleanup !== undefined && typeof lifecycle.cleanup !== "function") {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `runtime lifecycle cleanup must be a function: ${id}`,
      });
      return;
    }
    (registry.runtimeLifecycles ??= []).push({
      pluginId: record.id,
      pluginName: record.name,
      lifecycle: { ...lifecycle, id },
      source: record.source,
      rootDir: record.rootDir,
    });
  };

  const registerAgentEventSubscription = (
    record: PluginRecord,
    subscription: PluginAgentEventSubscriptionRegistration,
  ) => {
    const id = normalizePluginHostHookId(subscription.id);
    if (!id || typeof subscription.handle !== "function") {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: "agent event subscription registration requires id and handle",
      });
      return;
    }
    const streams = normalizeHostHookStringList(subscription.streams);
    if (streams === null) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `agent event subscription streams must be an array of strings: ${id}`,
      });
      return;
    }
    const existing = (registry.agentEventSubscriptions ?? []).find(
      (entry) => entry.pluginId === record.id && entry.subscription.id === id,
    );
    if (existing) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `agent event subscription already registered: ${id}`,
      });
      return;
    }
    (registry.agentEventSubscriptions ??= []).push({
      pluginId: record.id,
      pluginName: record.name,
      subscription: { ...subscription, id, ...(streams !== undefined ? { streams } : {}) },
      source: record.source,
      rootDir: record.rootDir,
    });
  };

  const registerSessionSchedulerJob = (
    record: PluginRecord,
    job: PluginSessionSchedulerJobRegistration,
  ) => {
    const jobId = normalizeHostHookString(job.id);
    const sessionKey = normalizeHostHookString(job.sessionKey);
    const kind = normalizeHostHookString(job.kind);
    if (
      jobId &&
      (registry.sessionSchedulerJobs ?? []).some(
        (entry) => entry.pluginId === record.id && entry.job.id === jobId,
      )
    ) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `session scheduler job already registered: ${jobId}`,
      });
      return undefined;
    }
    if (!jobId || !sessionKey || !kind) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: "session scheduler job registration requires unique id, sessionKey, and kind",
      });
      return undefined;
    }
    if (job.cleanup !== undefined && typeof job.cleanup !== "function") {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `session scheduler job cleanup must be a function: ${jobId}`,
      });
      return undefined;
    }
    if (registryParams.activateGlobalSideEffects === false) {
      (registry.sessionSchedulerJobs ??= []).push({
        pluginId: record.id,
        pluginName: record.name,
        job: { ...job, id: jobId, sessionKey, kind },
        source: record.source,
        rootDir: record.rootDir,
      });
      return { id: jobId, pluginId: record.id, sessionKey, kind };
    }
    const handle = registerPluginSessionSchedulerJob({
      pluginId: record.id,
      pluginName: record.name,
      ownerRegistry: registry,
      job: { ...job, id: jobId, sessionKey, kind },
    });
    if (!handle) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: "session scheduler job registration requires unique id, sessionKey, and kind",
      });
      return undefined;
    }
    (registry.sessionSchedulerJobs ??= []).push({
      pluginId: record.id,
      pluginName: record.name,
      job: { ...job, id: handle.id, sessionKey: handle.sessionKey, kind: handle.kind },
      generation: getPluginSessionSchedulerJobGeneration({
        pluginId: record.id,
        jobId: handle.id,
        sessionKey: handle.sessionKey,
      }),
      source: record.source,
      rootDir: record.rootDir,
    });
    return handle;
  };

  const registerSessionAction = (record: PluginRecord, action: PluginSessionActionRegistration) => {
    const id = normalizeHostHookString(action.id);
    const description = normalizeOptionalHostHookString(action.description);
    const requiredScopes = normalizeHostHookStringList(action.requiredScopes);
    if (
      !id ||
      description === "" ||
      requiredScopes === null ||
      typeof action.handler !== "function"
    ) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: "session action registration requires id, handler, and valid optional fields",
      });
      return;
    }
    if (requiredScopes !== undefined) {
      const unknownScope = requiredScopes.find((scope) => !isOperatorScope(scope));
      if (unknownScope !== undefined) {
        pushDiagnostic({
          level: "error",
          pluginId: record.id,
          source: record.source,
          message: `session action requiredScopes contains unknown operator scope: ${unknownScope}`,
        });
        return;
      }
    }
    if (!validateSessionActionSchema(record, id, action.schema)) {
      return;
    }
    const existing = (registry.sessionActions ?? []).find(
      (entry) => entry.pluginId === record.id && entry.action.id === id,
    );
    if (existing) {
      pushDiagnostic({
        level: "error",
        pluginId: record.id,
        source: record.source,
        message: `session action already registered: ${id}`,
      });
      return;
    }
    (registry.sessionActions ??= []).push({
      pluginId: record.id,
      pluginName: record.name,
      action: {
        ...action,
        id,
        ...(description !== undefined ? { description } : {}),
        ...(requiredScopes !== undefined
          ? { requiredScopes: requiredScopes as OperatorScope[] }
          : {}),
      },
      source: record.source,
      rootDir: record.rootDir,
    } satisfies PluginSessionActionRegistryRegistration);
  };

  const pluginSideEffectGuards = new Map<string, Set<{ active: boolean }>>();

  const createPluginSideEffectGuard = (pluginId: string): { active: boolean } => {
    const guard = { active: true };
    const guards = pluginSideEffectGuards.get(pluginId) ?? new Set<{ active: boolean }>();
    guards.add(guard);
    pluginSideEffectGuards.set(pluginId, guards);
    return guard;
  };

  const deactivatePluginSideEffectGuards = (pluginId: string): void => {
    const guards = pluginSideEffectGuards.get(pluginId);
    if (!guards) {
      return;
    }
    for (const guard of guards) {
      guard.active = false;
    }
    pluginSideEffectGuards.delete(pluginId);
  };

  const getHostCronService = () => registryParams.hostServices?.cron;

  const normalizeLogger = (logger: PluginLogger): PluginLogger => ({
    info: logger.info,
    warn: logger.warn,
    error: logger.error,
    debug: logger.debug,
  });

  const pluginRuntimeById = new Map<string, PluginRuntime>();

  const resolvePluginRuntime = (pluginId: string): PluginRuntime => {
    const cached = pluginRuntimeById.get(pluginId);
    if (cached) {
      return cached;
    }
    const runtime = new Proxy(registryParams.runtime, {
      get(target, prop, receiver) {
        if (prop !== "subagent") {
          return Reflect.get(target, prop, receiver);
        }
        const subagent = Reflect.get(target, prop, receiver);
        return {
          run: (params) => withPluginRuntimePluginIdScope(pluginId, () => subagent.run(params)),
          waitForRun: (params) =>
            withPluginRuntimePluginIdScope(pluginId, () => subagent.waitForRun(params)),
          getSessionMessages: (params) =>
            withPluginRuntimePluginIdScope(pluginId, () => subagent.getSessionMessages(params)),
          getSession: (params) =>
            withPluginRuntimePluginIdScope(pluginId, () => subagent.getSession(params)),
          deleteSession: (params) =>
            withPluginRuntimePluginIdScope(pluginId, () => subagent.deleteSession(params)),
        } satisfies PluginRuntime["subagent"];
      },
    });
    pluginRuntimeById.set(pluginId, runtime);
    return runtime;
  };

  const createApi = (
    record: PluginRecord,
    params: {
      config: CoreBlowPluginApi["config"];
      pluginConfig?: Record<string, unknown>;
      hookPolicy?: PluginTypedHookPolicy;
      registrationMode?: PluginRegistrationMode;
    },
  ): CoreBlowPluginApi => {
    const registrationMode = params.registrationMode ?? "full";
    const sideEffectGuard = createPluginSideEffectGuard(record.id);
    const isLoadedRecordInRegistry = () =>
      registry.plugins.some((plugin) => plugin.id === record.id && plugin.status === "loaded");
    const isLoadedRecordInActiveRegistry = () =>
      getActivePluginRegistry() === registry && isLoadedRecordInRegistry();
    const isActivatingLoadedRecord = () =>
      registryParams.activateGlobalSideEffects !== false &&
      record.enabled &&
      record.status === "loaded" &&
      !registry.plugins.some((plugin) => plugin.id === record.id);
    const shouldCommitWorkflowSideEffect = () =>
      sideEffectGuard.active &&
      !isPluginRegistryRetired(registry) &&
      (isActivatingLoadedRecord() ||
        (isPluginRegistryActivated(registry) && isLoadedRecordInRegistry()));
    return buildPluginApi({
      id: record.id,
      name: record.name,
      version: record.version,
      description: record.description,
      source: record.source,
      rootDir: record.rootDir,
      registrationMode,
      config: params.config,
      pluginConfig: params.pluginConfig,
      runtime: resolvePluginRuntime(record.id),
      logger: normalizeLogger(registryParams.logger),
      resolvePath: (input: string) => resolveUserPath(input),
      handlers: {
        ...(registrationMode === "full"
          ? {
              registerTool: (tool, opts) => registerTool(record, tool, opts),
              registerAgentToolResultMiddleware: (middleware, opts) =>
                registerAgentToolResultMiddleware(record, middleware, opts),
              registerSessionExtension: (extension) => registerSessionExtension(record, extension),
              enqueueNextTurnInjection: (injection) => {
                if (params.hookPolicy?.allowPromptInjection === false) {
                  pushDiagnostic({
                    level: "warn",
                    pluginId: record.id,
                    source: record.source,
                    message: `next-turn injection blocked by plugins.entries.${record.id}.hooks.allowPromptInjection=false`,
                  });
                  return Promise.resolve({
                    enqueued: false,
                    id: "",
                    sessionKey: injection.sessionKey,
                  });
                }
                const runtimeConfig =
                  (
                    registryParams.runtime as unknown as {
                      config?: { current?: () => CoreBlowConfig };
                    }
                  )?.config?.current?.() ?? (params.config as CoreBlowConfig);
                return enqueuePluginNextTurnInjection({
                  cfg: runtimeConfig,
                  pluginId: record.id,
                  pluginName: record.name,
                  injection,
                });
              },
              registerTrustedToolPolicy: (policy) => registerTrustedToolPolicy(record, policy),
              registerToolMetadata: (metadata) => registerToolMetadata(record, metadata),
              registerControlUiDescriptor: (descriptor) =>
                registerControlUiDescriptor(record, descriptor),
              registerRuntimeLifecycle: (lifecycle) => registerRuntimeLifecycle(record, lifecycle),
              registerAgentEventSubscription: (subscription) =>
                registerAgentEventSubscription(record, subscription),
              emitAgentEvent: (event) => {
                if (registryParams.activateGlobalSideEffects === false) {
                  return { emitted: false, reason: "global side effects disabled" };
                }
                if (!shouldCommitWorkflowSideEffect()) {
                  return { emitted: false, reason: "plugin is not loaded" };
                }
                return emitPluginAgentEvent({
                  pluginId: record.id,
                  pluginName: record.name,
                  origin: record.origin,
                  event,
                });
              },
              setRunContext: (patch) =>
                registryParams.activateGlobalSideEffects !== false &&
                shouldCommitWorkflowSideEffect()
                  ? setPluginRunContext({ pluginId: record.id, patch })
                  : false,
              getRunContext: (get) => getPluginRunContext({ pluginId: record.id, get }),
              clearRunContext: (runContextParams) => {
                if (
                  registryParams.activateGlobalSideEffects === false ||
                  !shouldCommitWorkflowSideEffect()
                ) {
                  return;
                }
                clearPluginRunContext({
                  pluginId: record.id,
                  runId: runContextParams.runId,
                  namespace: runContextParams.namespace,
                });
              },
              registerSessionSchedulerJob: (job) => registerSessionSchedulerJob(record, job),
              registerSessionAction: (action) => registerSessionAction(record, action),
              sendSessionAttachment: async (attachment) => {
                if (registryParams.activateGlobalSideEffects === false) {
                  return { ok: false, error: "global side effects disabled" };
                }
                try {
                  if (!isLoadedRecordInActiveRegistry()) {
                    return { ok: false, error: "plugin is not loaded" };
                  }
                  const runtimeConfig =
                    (
                      registryParams.runtime as unknown as {
                        config?: { current?: () => CoreBlowConfig };
                      }
                    )?.config?.current?.() ?? (params.config as CoreBlowConfig);
                  return await sendPluginSessionAttachment({
                    ...attachment,
                    config: runtimeConfig,
                    origin: record.origin,
                  });
                } catch (error) {
                  return {
                    ok: false,
                    error: `attachment delivery setup failed: ${formatErrorMessage(error)}`,
                  };
                }
              },
              scheduleSessionTurn: async (schedule) => {
                if (registryParams.activateGlobalSideEffects === false) {
                  return undefined;
                }
                await Promise.resolve();
                return schedulePluginSessionTurn({
                  pluginId: record.id,
                  pluginName: record.name,
                  origin: record.origin,
                  schedule,
                  cron: getHostCronService(),
                  shouldCommit: isLoadedRecordInActiveRegistry,
                  ownerRegistry: registry,
                });
              },
              unscheduleSessionTurnsByTag: async (request) => {
                if (registryParams.activateGlobalSideEffects === false) {
                  return { removed: 0, failed: 0 };
                }
                await Promise.resolve();
                if (!isLoadedRecordInActiveRegistry()) {
                  return { removed: 0, failed: 0 };
                }
                return unschedulePluginSessionTurnsByTag({
                  pluginId: record.id,
                  origin: record.origin,
                  cron: getHostCronService(),
                  request,
                });
              },
              registerHook: (events, handler, opts) =>
                registerHook(record, events, handler, opts, params.config),
              registerHttpRoute: (routeParams) => registerHttpRoute(record, routeParams),
              registerProvider: (provider) => registerProvider(record, provider),
              registerSpeechProvider: (provider) => registerSpeechProvider(record, provider),
              registerMediaUnderstandingProvider: (provider) =>
                registerMediaUnderstandingProvider(record, provider),
              registerImageGenerationProvider: (provider) =>
                registerImageGenerationProvider(record, provider),
              registerVideoGenerationProvider: (provider) =>
                registerVideoGenerationProvider(record, provider),
              registerMusicGenerationProvider: (provider) =>
                registerMusicGenerationProvider(record, provider),
              registerRealtimeTranscriptionProvider: (provider) =>
                registerRealtimeTranscriptionProvider(record, provider),
              registerRealtimeVoiceProvider: (provider: RealtimeVoiceProviderPlugin) =>
                registerRealtimeVoiceProvider(record, provider),
              registerWebSearchProvider: (provider) => registerWebSearchProvider(record, provider),
              registerMigrationProvider: (provider: MigrationProviderPlugin) => registerMigrationProvider(record, provider),
              registerGatewayMethod: (method, handler, opts) =>
                registerGatewayMethod(record, method, handler, opts),
              registerNodeHostCommand: (command) => registerNodeHostCommand(record, command),
              registerNodeInvokePolicy: (policy) =>
                registerNodeInvokePolicy(record, policy, params.pluginConfig),
              registerCli: (registrar, opts) => registerCli(record, registrar, opts),
              registerService: (service) => registerService(record, service),
              registerCliBackend: (backend) => registerCliBackend(record, backend),
              registerInteractiveHandler: (registration) => {
                const result = registerPluginInteractiveHandler(record.id, registration, {
                  pluginName: record.name,
                  pluginRoot: record.rootDir,
                });
                if (!result.ok) {
                  pushDiagnostic({
                    level: "warn",
                    pluginId: record.id,
                    source: record.source,
                    message: result.error ?? "interactive handler registration failed",
                  });
                }
              },
              onConversationBindingResolved: (handler) =>
                registerConversationBindingResolvedHandler(record, handler),
              registerCommand: (command) => registerCommand(record, command),
              registerContextEngine: (id, factory) => {
                if (id === defaultSlotIdForKey("contextEngine")) {
                  pushDiagnostic({
                    level: "error",
                    pluginId: record.id,
                    source: record.source,
                    message: `context engine id reserved by core: ${id}`,
                  });
                  return;
                }
                const result = registerContextEngineForOwner(id, factory, `plugin:${record.id}`, {
                  allowSameOwnerRefresh: true,
                });
                if (!result.ok) {
                  pushDiagnostic({
                    level: "error",
                    pluginId: record.id,
                    source: record.source,
                    message: `context engine already registered: ${id} (${result.existingOwner})`,
                  });
                }
              },
              registerMemoryPromptSection: (builder) => {
                if (record.kind !== "memory") {
                  pushDiagnostic({
                    level: "error",
                    pluginId: record.id,
                    source: record.source,
                    message: "only memory plugins can register a memory prompt section",
                  });
                  return;
                }
                registerMemoryPromptSection(builder);
              },
              registerMemoryFlushPlan: (resolver) => {
                if (record.kind !== "memory") {
                  pushDiagnostic({
                    level: "error",
                    pluginId: record.id,
                    source: record.source,
                    message: "only memory plugins can register a memory flush plan",
                  });
                  return;
                }
                registerMemoryFlushPlanResolver(resolver);
              },
              registerMemoryRuntime: (runtime) => {
                if (record.kind !== "memory") {
                  pushDiagnostic({
                    level: "error",
                    pluginId: record.id,
                    source: record.source,
                    message: "only memory plugins can register a memory runtime",
                  });
                  return;
                }
                registerMemoryRuntime(runtime);
              },
              registerMemoryEmbeddingProvider: (adapter) => {
                if (record.kind !== "memory") {
                  pushDiagnostic({
                    level: "error",
                    pluginId: record.id,
                    source: record.source,
                    message: "only memory plugins can register memory embedding providers",
                  });
                  return;
                }
                const existing = getRegisteredMemoryEmbeddingProvider(adapter.id);
                if (existing) {
                  const ownerDetail = existing.ownerPluginId
                    ? ` (owner: ${existing.ownerPluginId})`
                    : "";
                  pushDiagnostic({
                    level: "error",
                    pluginId: record.id,
                    source: record.source,
                    message: `memory embedding provider already registered: ${adapter.id}${ownerDetail}`,
                  });
                  return;
                }
                registerMemoryEmbeddingProvider(adapter, {
                  ownerPluginId: record.id,
                });
              },
              on: (hookName, handler, opts) =>
                registerTypedHook(record, hookName, handler, opts, params.hookPolicy),
            }
          : {}),
        registerChannel: (registration) => registerChannel(record, registration, registrationMode),
      },
    });
  };

  return {
    registry,
    createApi,
    pushDiagnostic,
    registerTool,
    registerAgentToolResultMiddleware,
    registerChannel,
    registerProvider,
    registerCliBackend,
    registerSpeechProvider,
    registerMediaUnderstandingProvider,
    registerImageGenerationProvider,
    registerVideoGenerationProvider,
    registerMusicGenerationProvider,
    registerWebSearchProvider,
    registerMigrationProvider,
    registerGatewayMethod,
    registerNodeHostCommand,
    registerNodeInvokePolicy,
    registerCli,
    registerService,
    registerCommand,
    registerSessionExtension,
    registerTrustedToolPolicy,
    registerToolMetadata,
    registerControlUiDescriptor,
    registerRuntimeLifecycle,
    registerAgentEventSubscription,
    registerSessionSchedulerJob,
    registerSessionAction,
    registerHook,
    registerTypedHook,
  };
}
