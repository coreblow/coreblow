import type { CoreBlowConfig } from "../config/config.js";
import { attachPluginApiFacades, type CoreBlowPluginApiWithoutFacades } from "./api-facades.js";
import type { PluginRuntime } from "./runtime/types.js";
import type { CoreBlowPluginApi, PluginLogger } from "./types.js";

export type BuildPluginApiParams = {
  id: string;
  name: string;
  version?: string;
  description?: string;
  source: string;
  rootDir?: string;
  registrationMode: CoreBlowPluginApi["registrationMode"];
  config: CoreBlowConfig;
  pluginConfig?: Record<string, unknown>;
  runtime: PluginRuntime;
  logger: PluginLogger;
  resolvePath: (input: string) => string;
  handlers?: Partial<
    Pick<
      CoreBlowPluginApi,
      | "registerTool"
      | "registerAgentToolResultMiddleware"
      | "registerHook"
      | "registerHttpRoute"
      | "registerChannel"
      | "registerGatewayMethod"
      | "registerNodeHostCommand"
      | "registerNodeInvokePolicy"
      | "registerCli"
      | "registerService"
      | "registerCliBackend"
      | "registerConfigMigration"
      | "registerAutoEnableProbe"
      | "registerProvider"
      | "registerSpeechProvider"
      | "registerMediaUnderstandingProvider"
      | "registerImageGenerationProvider"
      | "registerVideoGenerationProvider"
      | "registerMusicGenerationProvider"
      | "registerRealtimeTranscriptionProvider"
      | "registerRealtimeVoiceProvider"
      | "registerWebSearchProvider"
      | "registerInteractiveHandler"
      | "onConversationBindingResolved"
      | "registerCommand"
      | "registerContextEngine"
      | "registerMemoryPromptSection"
      | "registerMemoryFlushPlan"
      | "registerMemoryRuntime"
      | "registerMemoryEmbeddingProvider"
      | "registerSessionExtension"
      | "enqueueNextTurnInjection"
      | "registerTrustedToolPolicy"
      | "registerToolMetadata"
      | "registerControlUiDescriptor"
      | "registerRuntimeLifecycle"
      | "registerAgentEventSubscription"
      | "emitAgentEvent"
      | "setRunContext"
      | "getRunContext"
      | "clearRunContext"
      | "registerSessionSchedulerJob"
      | "registerSessionAction"
      | "sendSessionAttachment"
      | "scheduleSessionTurn"
      | "unscheduleSessionTurnsByTag"
      | "on"
    >
  >;
};

const noopRegisterTool: CoreBlowPluginApi["registerTool"] = () => {};
const noopRegisterAgentToolResultMiddleware: CoreBlowPluginApi["registerAgentToolResultMiddleware"] =
  () => {};
const noopRegisterHook: CoreBlowPluginApi["registerHook"] = () => {};
const noopRegisterHttpRoute: CoreBlowPluginApi["registerHttpRoute"] = () => {};
const noopRegisterChannel: CoreBlowPluginApi["registerChannel"] = () => {};
const noopRegisterGatewayMethod: CoreBlowPluginApi["registerGatewayMethod"] = () => {};
const noopRegisterNodeHostCommand: CoreBlowPluginApi["registerNodeHostCommand"] = () => {};
const noopRegisterNodeInvokePolicy: CoreBlowPluginApi["registerNodeInvokePolicy"] = () => {};
const noopRegisterCli: CoreBlowPluginApi["registerCli"] = () => {};
const noopRegisterService: CoreBlowPluginApi["registerService"] = () => {};
const noopRegisterCliBackend: CoreBlowPluginApi["registerCliBackend"] = () => {};
const noopRegisterConfigMigration: NonNullable<CoreBlowPluginApi["registerConfigMigration"]> = () => {};
const noopRegisterAutoEnableProbe: NonNullable<CoreBlowPluginApi["registerAutoEnableProbe"]> = () => {};
const noopRegisterProvider: CoreBlowPluginApi["registerProvider"] = () => {};
const noopRegisterSpeechProvider: CoreBlowPluginApi["registerSpeechProvider"] = () => {};
const noopRegisterMediaUnderstandingProvider: CoreBlowPluginApi["registerMediaUnderstandingProvider"] =
  () => {};
const noopRegisterImageGenerationProvider: CoreBlowPluginApi["registerImageGenerationProvider"] =
  () => {};
const noopRegisterVideoGenerationProvider: CoreBlowPluginApi["registerVideoGenerationProvider"] =
  () => {};
const noopRegisterMusicGenerationProvider: CoreBlowPluginApi["registerMusicGenerationProvider"] =
  () => {};
const noopRegisterRealtimeTranscriptionProvider: CoreBlowPluginApi["registerRealtimeTranscriptionProvider"] =
  () => {};
const noopRegisterRealtimeVoiceProvider: CoreBlowPluginApi["registerRealtimeVoiceProvider"] =
  () => {};
const noopRegisterWebSearchProvider: CoreBlowPluginApi["registerWebSearchProvider"] = () => {};
const noopRegisterInteractiveHandler: CoreBlowPluginApi["registerInteractiveHandler"] = () => {};
const noopOnConversationBindingResolved: CoreBlowPluginApi["onConversationBindingResolved"] =
  () => {};
const noopRegisterCommand: CoreBlowPluginApi["registerCommand"] = () => {};
const noopRegisterContextEngine: CoreBlowPluginApi["registerContextEngine"] = () => {};
const noopRegisterMemoryPromptSection: CoreBlowPluginApi["registerMemoryPromptSection"] = () => {};
const noopRegisterMemoryFlushPlan: CoreBlowPluginApi["registerMemoryFlushPlan"] = () => {};
const noopRegisterMemoryRuntime: CoreBlowPluginApi["registerMemoryRuntime"] = () => {};
const noopRegisterMemoryEmbeddingProvider: CoreBlowPluginApi["registerMemoryEmbeddingProvider"] =
  () => {};
const noopRegisterSessionExtension: CoreBlowPluginApi["registerSessionExtension"] = () => {};
const noopEnqueueNextTurnInjection: CoreBlowPluginApi["enqueueNextTurnInjection"] = async (
  injection,
) => ({ enqueued: false, id: "", sessionKey: injection.sessionKey });
const noopRegisterTrustedToolPolicy: CoreBlowPluginApi["registerTrustedToolPolicy"] = () => {};
const noopRegisterToolMetadata: CoreBlowPluginApi["registerToolMetadata"] = () => {};
const noopRegisterControlUiDescriptor: CoreBlowPluginApi["registerControlUiDescriptor"] = () => {};
const noopRegisterRuntimeLifecycle: CoreBlowPluginApi["registerRuntimeLifecycle"] = () => {};
const noopRegisterAgentEventSubscription: CoreBlowPluginApi["registerAgentEventSubscription"] =
  () => {};
const noopEmitAgentEvent: CoreBlowPluginApi["emitAgentEvent"] = () => ({
  emitted: false,
  reason: "not wired",
});
const noopSetRunContext: CoreBlowPluginApi["setRunContext"] = () => false;
const noopGetRunContext: CoreBlowPluginApi["getRunContext"] = () => undefined;
const noopClearRunContext: CoreBlowPluginApi["clearRunContext"] = () => {};
const noopRegisterSessionSchedulerJob: CoreBlowPluginApi["registerSessionSchedulerJob"] = () =>
  undefined;
const noopRegisterSessionAction: CoreBlowPluginApi["registerSessionAction"] = () => {};
const noopSendSessionAttachment: CoreBlowPluginApi["sendSessionAttachment"] = async () => ({
  ok: false,
  error: "not wired",
});
const noopScheduleSessionTurn: CoreBlowPluginApi["scheduleSessionTurn"] = async () => undefined;
const noopUnscheduleSessionTurnsByTag: CoreBlowPluginApi["unscheduleSessionTurnsByTag"] =
  async () => ({ removed: 0, failed: 0 });
const noopOn: CoreBlowPluginApi["on"] = () => {};

export function buildPluginApi(params: BuildPluginApiParams): CoreBlowPluginApi {
  const handlers = params.handlers ?? {};
  const api: CoreBlowPluginApiWithoutFacades = {
    id: params.id,
    name: params.name,
    version: params.version,
    description: params.description,
    source: params.source,
    rootDir: params.rootDir,
    registrationMode: params.registrationMode,
    config: params.config,
    pluginConfig: params.pluginConfig,
    runtime: params.runtime,
    logger: params.logger,
    resolvePath: params.resolvePath,
    registerTool: handlers.registerTool ?? noopRegisterTool,
    registerAgentToolResultMiddleware:
      handlers.registerAgentToolResultMiddleware ?? noopRegisterAgentToolResultMiddleware,
    registerHook: handlers.registerHook ?? noopRegisterHook,
    registerHttpRoute: handlers.registerHttpRoute ?? noopRegisterHttpRoute,
    registerChannel: handlers.registerChannel ?? noopRegisterChannel,
    registerGatewayMethod: handlers.registerGatewayMethod ?? noopRegisterGatewayMethod,
    registerNodeHostCommand: handlers.registerNodeHostCommand ?? noopRegisterNodeHostCommand,
    registerNodeInvokePolicy: handlers.registerNodeInvokePolicy ?? noopRegisterNodeInvokePolicy,
    registerCli: handlers.registerCli ?? noopRegisterCli,
    registerService: handlers.registerService ?? noopRegisterService,
    registerCliBackend: handlers.registerCliBackend ?? noopRegisterCliBackend,
    registerConfigMigration: handlers.registerConfigMigration ?? noopRegisterConfigMigration,
    registerAutoEnableProbe: handlers.registerAutoEnableProbe ?? noopRegisterAutoEnableProbe,
    registerProvider: handlers.registerProvider ?? noopRegisterProvider,
    registerSpeechProvider: handlers.registerSpeechProvider ?? noopRegisterSpeechProvider,
    registerMediaUnderstandingProvider:
      handlers.registerMediaUnderstandingProvider ?? noopRegisterMediaUnderstandingProvider,
    registerImageGenerationProvider:
      handlers.registerImageGenerationProvider ?? noopRegisterImageGenerationProvider,
    registerVideoGenerationProvider:
      handlers.registerVideoGenerationProvider ?? noopRegisterVideoGenerationProvider,
    registerMusicGenerationProvider:
      handlers.registerMusicGenerationProvider ?? noopRegisterMusicGenerationProvider,
    registerRealtimeTranscriptionProvider:
      handlers.registerRealtimeTranscriptionProvider ?? noopRegisterRealtimeTranscriptionProvider,
    registerRealtimeVoiceProvider:
      handlers.registerRealtimeVoiceProvider ?? noopRegisterRealtimeVoiceProvider,
    registerWebSearchProvider: handlers.registerWebSearchProvider ?? noopRegisterWebSearchProvider,
    registerInteractiveHandler:
      handlers.registerInteractiveHandler ?? noopRegisterInteractiveHandler,
    onConversationBindingResolved:
      handlers.onConversationBindingResolved ?? noopOnConversationBindingResolved,
    registerCommand: handlers.registerCommand ?? noopRegisterCommand,
    registerContextEngine: handlers.registerContextEngine ?? noopRegisterContextEngine,
    registerMemoryPromptSection:
      handlers.registerMemoryPromptSection ?? noopRegisterMemoryPromptSection,
    registerMemoryFlushPlan: handlers.registerMemoryFlushPlan ?? noopRegisterMemoryFlushPlan,
    registerMemoryRuntime: handlers.registerMemoryRuntime ?? noopRegisterMemoryRuntime,
    registerMemoryEmbeddingProvider:
      handlers.registerMemoryEmbeddingProvider ?? noopRegisterMemoryEmbeddingProvider,
    registerSessionExtension: handlers.registerSessionExtension ?? noopRegisterSessionExtension,
    enqueueNextTurnInjection: handlers.enqueueNextTurnInjection ?? noopEnqueueNextTurnInjection,
    registerTrustedToolPolicy: handlers.registerTrustedToolPolicy ?? noopRegisterTrustedToolPolicy,
    registerToolMetadata: handlers.registerToolMetadata ?? noopRegisterToolMetadata,
    registerControlUiDescriptor:
      handlers.registerControlUiDescriptor ?? noopRegisterControlUiDescriptor,
    registerRuntimeLifecycle: handlers.registerRuntimeLifecycle ?? noopRegisterRuntimeLifecycle,
    registerAgentEventSubscription:
      handlers.registerAgentEventSubscription ?? noopRegisterAgentEventSubscription,
    emitAgentEvent: handlers.emitAgentEvent ?? noopEmitAgentEvent,
    setRunContext: handlers.setRunContext ?? noopSetRunContext,
    getRunContext: handlers.getRunContext ?? noopGetRunContext,
    clearRunContext: handlers.clearRunContext ?? noopClearRunContext,
    registerSessionSchedulerJob:
      handlers.registerSessionSchedulerJob ?? noopRegisterSessionSchedulerJob,
    registerSessionAction: handlers.registerSessionAction ?? noopRegisterSessionAction,
    sendSessionAttachment: handlers.sendSessionAttachment ?? noopSendSessionAttachment,
    scheduleSessionTurn: handlers.scheduleSessionTurn ?? noopScheduleSessionTurn,
    unscheduleSessionTurnsByTag:
      handlers.unscheduleSessionTurnsByTag ?? noopUnscheduleSessionTurnsByTag,
    on: handlers.on ?? noopOn,
  };
  return attachPluginApiFacades(api);
}
