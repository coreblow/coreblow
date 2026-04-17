import type { CoreBlowConfig } from "../config/config.js";
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
      | "registerHook"
      | "registerHttpRoute"
      | "registerChannel"
      | "registerGatewayMethod"
      | "registerCli"
      | "registerService"
      | "registerCliBackend"
      | "registerProvider"
      | "registerSpeechProvider"
      | "registerMediaUnderstandingProvider"
      | "registerImageGenerationProvider"
      | "registerWebSearchProvider"
      | "registerInteractiveHandler"
      | "onConversationBindingResolved"
      | "registerCommand"
      | "registerContextEngine"
      | "registerMemoryPromptSection"
      | "registerMemoryFlushPlan"
      | "registerMemoryRuntime"
      | "registerMemoryEmbeddingProvider"
      | "on"
    >
  >;
};

const noopRegisterTool: CoreBlowPluginApi["registerTool"] = () => {};
const noopRegisterHook: CoreBlowPluginApi["registerHook"] = () => {};
const noopRegisterHttpRoute: CoreBlowPluginApi["registerHttpRoute"] = () => {};
const noopRegisterChannel: CoreBlowPluginApi["registerChannel"] = () => {};
const noopRegisterGatewayMethod: CoreBlowPluginApi["registerGatewayMethod"] = () => {};
const noopRegisterCli: CoreBlowPluginApi["registerCli"] = () => {};
const noopRegisterService: CoreBlowPluginApi["registerService"] = () => {};
const noopRegisterCliBackend: CoreBlowPluginApi["registerCliBackend"] = () => {};
const noopRegisterProvider: CoreBlowPluginApi["registerProvider"] = () => {};
const noopRegisterSpeechProvider: CoreBlowPluginApi["registerSpeechProvider"] = () => {};
const noopRegisterMediaUnderstandingProvider: CoreBlowPluginApi["registerMediaUnderstandingProvider"] =
  () => {};
const noopRegisterImageGenerationProvider: CoreBlowPluginApi["registerImageGenerationProvider"] =
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
const noopOn: CoreBlowPluginApi["on"] = () => {};

export function buildPluginApi(params: BuildPluginApiParams): CoreBlowPluginApi {
  const handlers = params.handlers ?? {};
  return {
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
    registerTool: handlers.registerTool ?? noopRegisterTool,
    registerHook: handlers.registerHook ?? noopRegisterHook,
    registerHttpRoute: handlers.registerHttpRoute ?? noopRegisterHttpRoute,
    registerChannel: handlers.registerChannel ?? noopRegisterChannel,
    registerGatewayMethod: handlers.registerGatewayMethod ?? noopRegisterGatewayMethod,
    registerCli: handlers.registerCli ?? noopRegisterCli,
    registerService: handlers.registerService ?? noopRegisterService,
    registerCliBackend: handlers.registerCliBackend ?? noopRegisterCliBackend,
    registerProvider: handlers.registerProvider ?? noopRegisterProvider,
    registerSpeechProvider: handlers.registerSpeechProvider ?? noopRegisterSpeechProvider,
    registerMediaUnderstandingProvider:
      handlers.registerMediaUnderstandingProvider ?? noopRegisterMediaUnderstandingProvider,
    registerImageGenerationProvider:
      handlers.registerImageGenerationProvider ?? noopRegisterImageGenerationProvider,
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
    resolvePath: params.resolvePath,
    on: handlers.on ?? noopOn,
  };
}
