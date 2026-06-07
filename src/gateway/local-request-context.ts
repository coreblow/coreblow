import { loadModelCatalog } from "../agents/model-catalog.js";
import type { CliDeps } from "../cli/deps.js";
import type { CoreBlowConfig } from "../config/config.js";
import { CronService } from "../cron/service.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import {
  getPluginRuntimeGatewayRequestScope,
  withPluginRuntimeGatewayRequestScope,
} from "../plugins/runtime/gateway-request-scope.js";
import { NodeRegistry } from "./node-registry.js";
import type { ChannelRuntimeSnapshot } from "./server-channels.js";
import type { GatewayRequestContext } from "./server-methods/types.js";

type LocalGatewayRequestContextParams = {
  deps: CliDeps;
  getRuntimeConfig: () => CoreBlowConfig;
};

function unavailable(operation: string): never {
  throw new Error(`${operation} is unavailable in local embedded agent gateway context.`);
}

const unavailableCron = {
  start: async () => unavailable("Cron"),
  stop: () => {},
  status: async () => unavailable("Cron"),
  list: async () => unavailable("Cron"),
  listPage: async () => unavailable("Cron"),
  add: async () => unavailable("Cron"),
  update: async () => unavailable("Cron"),
  remove: async () => unavailable("Cron"),
  run: async () => unavailable("Cron"),
  enqueueRun: async () => unavailable("Cron"),
  getJob: () => undefined,
  wake: () => ({ ok: false, reason: "unwakeable-session-key" }),
} as unknown as CronService;

export function createLocalGatewayRequestContext(
  params: LocalGatewayRequestContextParams,
): GatewayRequestContext {
  const logGateway = createSubsystemLogger("gateway/local");
  const sessionEvents = new Set<string>();
  const chatRuns = new Map<string, { sessionKey: string; clientRunId: string }>();
  return {
    deps: params.deps,
    cron: unavailableCron,
    cronStorePath: "",
    loadGatewayModelCatalog: async () => await loadModelCatalog({ config: params.getRuntimeConfig() }),
    getHealthCache: () => null,
    refreshHealthSnapshot: async () =>
      ({}) as Awaited<ReturnType<GatewayRequestContext["refreshHealthSnapshot"]>>,
    logHealth: { error: (message) => logGateway.error(message) },
    logGateway,
    incrementPresenceVersion: () => 0,
    getHealthVersion: () => 0,
    broadcast: () => {},
    broadcastToConnIds: () => {},
    nodeSendToSession: () => {},
    nodeSendToAllSubscribed: () => {},
    nodeSubscribe: () => {},
    nodeUnsubscribe: () => {},
    nodeUnsubscribeAll: () => {},
    hasConnectedMobileNode: () => false,
    nodeRegistry: new NodeRegistry(),
    agentRunSeq: new Map(),
    chatAbortControllers: new Map(),
    chatAbortedRuns: new Map(),
    chatRunBuffers: new Map(),
    chatDeltaSentAt: new Map(),
    chatDeltaLastBroadcastLen: new Map(),
    addChatRun: (sessionId, entry) => {
      chatRuns.set(sessionId, entry);
    },
    removeChatRun: (sessionId, clientRunId, sessionKey) => {
      const entry = chatRuns.get(sessionId);
      if (!entry || entry.clientRunId !== clientRunId) {
        return undefined;
      }
      if (sessionKey !== undefined && entry.sessionKey !== sessionKey) {
        return undefined;
      }
      chatRuns.delete(sessionId);
      return entry;
    },
    subscribeSessionEvents: (connId) => {
      sessionEvents.add(connId);
    },
    unsubscribeSessionEvents: (connId) => {
      sessionEvents.delete(connId);
    },
    subscribeSessionMessageEvents: () => {},
    unsubscribeSessionMessageEvents: () => {},
    unsubscribeAllSessionEvents: (connId) => {
      sessionEvents.delete(connId);
    },
    getSessionEventSubscriberConnIds: () => sessionEvents,
    registerToolEventRecipient: () => {},
    dedupe: new Map(),
    wizardSessions: new Map(),
    findRunningWizard: () => null,
    purgeWizardSession: () => {},
    getRuntimeSnapshot: () =>
      ({ channels: {}, channelAccounts: {} }) satisfies ChannelRuntimeSnapshot,
    startChannel: async () => unavailable("Channel start"),
    stopChannel: async () => unavailable("Channel stop"),
    markChannelLoggedOut: () => {},
    wizardRunner: async () => unavailable("Onboarding wizard"),
    broadcastVoiceWakeChanged: () => {},
  };
}

export function withLocalGatewayRequestScope<T>(
  params: LocalGatewayRequestContextParams,
  run: () => T,
): T {
  const existing = getPluginRuntimeGatewayRequestScope();
  if (existing?.context) {
    return run();
  }
  return withPluginRuntimeGatewayRequestScope(
    {
      ...existing,
      context: createLocalGatewayRequestContext(params),
      isWebchatConnect: existing?.isWebchatConnect ?? (() => false),
    },
    run,
  );
}
