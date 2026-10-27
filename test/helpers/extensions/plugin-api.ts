import type { CoreBlowPluginApi } from "coreblow/plugin-sdk/plugin-runtime";
import { attachPluginApiFacades } from "../../../src/plugins/api-facades.js";

type TestPluginApiInput = Partial<CoreBlowPluginApi> &
  Pick<CoreBlowPluginApi, "id" | "name" | "source" | "config" | "runtime">;

export function createTestPluginApi(api: TestPluginApiInput): CoreBlowPluginApi {
  const base = {
    registrationMode: "full" as const,
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    registerTool() {},
    registerAgentToolResultMiddleware() {},
    registerHook() {},
    registerHttpRoute() {},
    registerChannel() {},
    registerGatewayMethod() {},
    registerNodeHostCommand() {},
    registerNodeInvokePolicy() {},
    registerCli() {},
    registerService() {},
    registerCliBackend() {},
    registerProvider() {},
    registerSpeechProvider() {},
    registerMediaUnderstandingProvider() {},
    registerImageGenerationProvider() {},
    registerVideoGenerationProvider() {},
    registerMusicGenerationProvider() {},
    registerRealtimeTranscriptionProvider() {},
    registerRealtimeVoiceProvider() {},
    registerWebSearchProvider() {},
    registerInteractiveHandler() {},
    onConversationBindingResolved() {},
    registerCommand() {},
    registerContextEngine() {},
    registerMemoryPromptSection() {},
    registerMemoryFlushPlan() {},
    registerMemoryRuntime() {},
    registerMemoryEmbeddingProvider() {},
    resolvePath(input: string) {
      return input;
    },
    registerTrustedToolPolicy() {},
    registerToolMetadata() {},
    registerSessionExtension() {},
    enqueueNextTurnInjection: async (inj: { sessionKey: string }) => ({
      enqueued: false,
      id: "",
      sessionKey: inj.sessionKey,
    }),
    registerSessionSchedulerJob: () => undefined,
    sendSessionAttachment: async () => ({ ok: false, error: "not implemented" }),
    scheduleSessionTurn: async () => undefined,
    unscheduleSessionTurnsByTag: async () => ({ ok: false, unscheduledCount: 0 }),
    registerSessionAction() {},
    registerControlUiDescriptor() {},
    registerRuntimeLifecycle() {},
    registerAgentEventSubscription() {},
    emitAgentEvent: () => ({ ok: false, subscriberCount: 0 }),
    setRunContext: () => false,
    getRunContext: () => undefined,
    clearRunContext() {},
    on() {},
    ...api,
  };
  return attachPluginApiFacades(base as never);
}
