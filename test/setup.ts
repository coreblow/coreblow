import { afterAll, afterEach, beforeAll, vi } from "vitest";

vi.mock("@mariozechner/pi-ai", async (importOriginal) => {
  const original = await importOriginal<typeof import("@mariozechner/pi-ai")>();
  return {
    ...original,
    getOAuthApiKey: () => undefined,
    getOAuthProviders: () => [],
    loginOpenAICodex: vi.fn(),
  };
});

vi.mock("@mariozechner/clipboard", () => ({
  availableFormats: () => [],
  getText: async () => "",
  setText: async () => {},
  hasText: () => false,
  getImageBinary: async () => [],
  getImageBase64: async () => "",
  setImageBinary: async () => {},
  setImageBase64: async () => {},
  hasImage: () => false,
  getHtml: async () => "",
  setHtml: async () => {},
  hasHtml: () => false,
  getRtf: async () => "",
  setRtf: async () => {},
  hasRtf: () => false,
  clear: async () => {},
  watch: () => {},
  callThreadsafeFunction: () => {},
}));

// Ensure Vitest environment is properly set
process.env.VITEST = "true";
// Config validation walks plugin manifests; keep an aggressive cache in tests to avoid
// repeated filesystem discovery across suites/workers.
process.env.COREBLOW_PLUGIN_MANIFEST_CACHE_MS ??= "60000";
// Vitest vm forks can load transitive lockfile helpers many times per worker.
// Raise listener budget to avoid noisy MaxListeners warnings and warning-stack overhead.
const TEST_PROCESS_MAX_LISTENERS = 128;
if (process.getMaxListeners() > 0 && process.getMaxListeners() < TEST_PROCESS_MAX_LISTENERS) {
  process.setMaxListeners(TEST_PROCESS_MAX_LISTENERS);
}

import type {
  ChannelId,
  ChannelOutboundAdapter,
  ChannelPlugin,
} from "../src/channels/plugins/types.js";
import type { CoreBlowConfig } from "../src/config/config.js";
import type { ReplyToMode } from "../src/config/types.base.js";
import type { OutboundSendDeps } from "../src/infra/outbound/deliver.js";
import { installProcessWarningFilter } from "../src/infra/warning-filter.js";
import type { PluginRegistry } from "../src/plugins/registry.js";
import { createTestRegistry } from "../src/test-utils/channel-plugins.js";
import { withIsolatedTestHome } from "./test-env.js";

// Set HOME/state isolation before importing any runtime CoreBlow modules.
const testEnv = withIsolatedTestHome();

installProcessWarningFilter();

const WORKER_RUNTIME_STATE = Symbol.for("coreblow.testSetupRuntimeState");
const WORKER_PLUGIN_RUNTIME_HELPERS = Symbol.for("coreblow.testSetupPluginRuntimeHelpers");

type WorkerRuntimeState = {
  defaultPluginRegistry: PluginRegistry | null;
  materializedDefaultPluginRegistry: PluginRegistry | null;
};

type WorkerPluginRuntimeHelpers = {
  resetPluginRuntimeStateForTest: typeof import("../src/plugins/runtime.js").resetPluginRuntimeStateForTest;
  setActivePluginRegistry: typeof import("../src/plugins/runtime.js").setActivePluginRegistry;
};

const workerRuntimeState = (() => {
  const globalState = globalThis as typeof globalThis & {
    [WORKER_RUNTIME_STATE]?: WorkerRuntimeState;
  };
  if (!globalState[WORKER_RUNTIME_STATE]) {
    globalState[WORKER_RUNTIME_STATE] = {
      defaultPluginRegistry: null,
      materializedDefaultPluginRegistry: null,
    };
  }
  return globalState[WORKER_RUNTIME_STATE];
})();

function loadWorkerPluginRuntimeHelpers(): Promise<WorkerPluginRuntimeHelpers> {
  const globalState = globalThis as typeof globalThis & {
    [WORKER_PLUGIN_RUNTIME_HELPERS]?: Promise<WorkerPluginRuntimeHelpers>;
  };
  globalState[WORKER_PLUGIN_RUNTIME_HELPERS] ??= import("../src/plugins/runtime.js").then(
    (pluginRuntime) => ({
      resetPluginRuntimeStateForTest: pluginRuntime.resetPluginRuntimeStateForTest,
      setActivePluginRegistry: pluginRuntime.setActivePluginRegistry,
    }),
  );
  return globalState[WORKER_PLUGIN_RUNTIME_HELPERS];
}

const pickSendFn = (id: ChannelId, deps?: OutboundSendDeps) => {
  return deps?.[id] as ((...args: unknown[]) => Promise<unknown>) | undefined;
};

function resolveSlackStubReplyToMode(params: {
  cfg: CoreBlowConfig;
  chatType?: string | null;
}): ReplyToMode {
  const entry = (
    params.cfg.channels as
      | Record<
          string,
          {
            replyToMode?: ReplyToMode;
            replyToModeByChatType?: Partial<
              Record<"direct" | "group" | "channel", ReplyToMode>
            >;
            dm?: { replyToMode?: ReplyToMode };
          }
        >
      | undefined
  )?.slack;
  const normalizedChatType = params.chatType?.trim().toLowerCase();
  if (
    normalizedChatType === "direct" ||
    normalizedChatType === "group" ||
    normalizedChatType === "channel"
  ) {
    const byChatType = entry?.replyToModeByChatType?.[normalizedChatType];
    if (byChatType) {
      return byChatType;
    }
    if (normalizedChatType === "direct" && entry?.dm?.replyToMode) {
      return entry.dm.replyToMode;
    }
  }
  return entry?.replyToMode ?? "off";
}

const createStubOutbound = (
  id: ChannelId,
  deliveryMode: ChannelOutboundAdapter["deliveryMode"] = "direct",
): ChannelOutboundAdapter => ({
  deliveryMode,
  sendText: async ({ deps, to, text }) => {
    const send = pickSendFn(id, deps);
    if (send) {
      // oxlint-disable-next-line typescript/no-explicit-any
      const result = (await send(to, text, { verbose: false } as any)) as {
        messageId: string;
      };
      return { channel: id, ...result };
    }
    return { channel: id, messageId: "test" };
  },
  sendMedia: async ({ deps, to, text, mediaUrl }) => {
    const send = pickSendFn(id, deps);
    if (send) {
      // oxlint-disable-next-line typescript/no-explicit-any
      const result = (await send(to, text, { verbose: false, mediaUrl } as any)) as {
        messageId: string;
      };
      return { channel: id, ...result };
    }
    return { channel: id, messageId: "test" };
  },
});

const createStubPlugin = (params: {
  id: ChannelId;
  label?: string;
  aliases?: string[];
  deliveryMode?: ChannelOutboundAdapter["deliveryMode"];
  preferSessionLookupForAnnounceTarget?: boolean;
  resolveReplyToMode?: (params: {
    cfg: CoreBlowConfig;
    accountId?: string | null;
    chatType?: string | null;
  }) => ReplyToMode;
}): ChannelPlugin => ({
  id: params.id,
  meta: {
    id: params.id,
    label: params.label ?? String(params.id),
    selectionLabel: params.label ?? String(params.id),
    docsPath: `/channels/${params.id}`,
    blurb: "test stub.",
    aliases: params.aliases,
    preferSessionLookupForAnnounceTarget: params.preferSessionLookupForAnnounceTarget,
  },
  capabilities: { chatTypes: ["direct", "group"] },
  threading: params.resolveReplyToMode
    ? {
        resolveReplyToMode: params.resolveReplyToMode,
      }
    : undefined,
  config: {
    listAccountIds: (cfg: CoreBlowConfig) => {
      const channels = cfg.channels as Record<string, unknown> | undefined;
      const entry = channels?.[params.id];
      if (!entry || typeof entry !== "object") {
        return [];
      }
      const accounts = (entry as { accounts?: Record<string, unknown> }).accounts;
      const ids = accounts ? Object.keys(accounts).filter(Boolean) : [];
      return ids.length > 0 ? ids : ["default"];
    },
    resolveAccount: (cfg: CoreBlowConfig, accountId?: string | null) => {
      const channels = cfg.channels as Record<string, unknown> | undefined;
      const entry = channels?.[params.id];
      if (!entry || typeof entry !== "object") {
        return {};
      }
      const accounts = (entry as { accounts?: Record<string, unknown> }).accounts;
      const match = accountId ? accounts?.[accountId] : undefined;
      return (match && typeof match === "object") || typeof match === "string" ? match : entry;
    },
    isConfigured: async (_account, cfg: CoreBlowConfig) => {
      const channels = cfg.channels as Record<string, unknown> | undefined;
      return Boolean(channels?.[params.id]);
    },
  },
  outbound: createStubOutbound(params.id, params.deliveryMode),
});

const createTopLevelChannelReplyToModeResolverForTest =
  (channelId: string) =>
  ({ cfg }: { cfg: CoreBlowConfig }) => {
    const channelConfig = (
      cfg.channels as Record<string, { replyToMode?: ReplyToMode }> | undefined
    )?.[channelId];
    return channelConfig?.replyToMode ?? "off";
  };

const createDefaultRegistry = () =>
  createTestRegistry([
    {
      pluginId: "discord",
      plugin: createStubPlugin({
        id: "discord",
        label: "Discord",
        resolveReplyToMode: createTopLevelChannelReplyToModeResolverForTest("discord"),
      }),
      source: "test",
    },
    {
      pluginId: "slack",
      plugin: createStubPlugin({
        id: "slack",
        label: "Slack",
        resolveReplyToMode: ({ cfg, chatType }) => resolveSlackStubReplyToMode({ cfg, chatType }),
      }),
      source: "test",
    },
    {
      pluginId: "telegram",
      plugin: {
        ...createStubPlugin({
          id: "telegram",
          label: "Telegram",
          resolveReplyToMode: createTopLevelChannelReplyToModeResolverForTest("telegram"),
        }),
        status: {
          buildChannelSummary: async () => ({
            configured: false,
            tokenSource: process.env.TELEGRAM_BOT_TOKEN ? "env" : "none",
          }),
        },
      },
      source: "test",
    },
    {
      pluginId: "whatsapp",
      plugin: createStubPlugin({
        id: "whatsapp",
        label: "WhatsApp",
        deliveryMode: "gateway",
        preferSessionLookupForAnnounceTarget: true,
      }),
      source: "test",
    },
    {
      pluginId: "signal",
      plugin: createStubPlugin({ id: "signal", label: "Signal" }),
      source: "test",
    },
    {
      pluginId: "imessage",
      plugin: createStubPlugin({ id: "imessage", label: "iMessage", aliases: ["imsg"] }),
      source: "test",
    },
  ]);

function getDefaultPluginRegistry(): PluginRegistry {
  workerRuntimeState.materializedDefaultPluginRegistry ??= createDefaultRegistry();
  return workerRuntimeState.materializedDefaultPluginRegistry;
}

function resolveDefaultPluginRegistryProxy(): PluginRegistry {
  workerRuntimeState.defaultPluginRegistry ??= new Proxy({} as PluginRegistry, {
    defineProperty(_target, property, attributes) {
      return Reflect.defineProperty(getDefaultPluginRegistry() as object, property, attributes);
    },
    deleteProperty(_target, property) {
      return Reflect.deleteProperty(getDefaultPluginRegistry() as object, property);
    },
    get(_target, property, receiver) {
      return Reflect.get(getDefaultPluginRegistry() as object, property, receiver);
    },
    getOwnPropertyDescriptor(_target, property) {
      return Reflect.getOwnPropertyDescriptor(getDefaultPluginRegistry() as object, property);
    },
    has(_target, property) {
      return Reflect.has(getDefaultPluginRegistry() as object, property);
    },
    ownKeys() {
      return Reflect.ownKeys(getDefaultPluginRegistry() as object);
    },
    set(_target, property, value, receiver) {
      return Reflect.set(getDefaultPluginRegistry() as object, property, value, receiver);
    },
  });
  return workerRuntimeState.defaultPluginRegistry;
}

async function installDefaultPluginRegistry(): Promise<void> {
  const { resetPluginRuntimeStateForTest, setActivePluginRegistry } =
    await loadWorkerPluginRuntimeHelpers();
  workerRuntimeState.materializedDefaultPluginRegistry = null;
  resetPluginRuntimeStateForTest();
  setActivePluginRegistry(resolveDefaultPluginRegistryProxy());
}

beforeAll(async () => {
  await installDefaultPluginRegistry();
});

afterEach(async () => {
  const [
    { cleanupSessionStateForTest },
    { resetContextWindowCacheForTest },
    { resetModelsJsonReadyCacheForTest },
    { resetSessionWriteLockStateForTest },
  ] = await Promise.all([
    import("../src/test-utils/session-state-cleanup.js"),
    import("../src/agents/context.js"),
    import("../src/agents/models-config.js"),
    import("../src/agents/session-write-lock.js"),
  ]);
  await cleanupSessionStateForTest();
  resetContextWindowCacheForTest();
  resetModelsJsonReadyCacheForTest();
  resetSessionWriteLockStateForTest();
  await installDefaultPluginRegistry();
});

afterAll(async () => {
  const [
    { cleanupSessionStateForTest },
    { drainSessionWriteLockStateForTest },
  ] = await Promise.all([
    import("../src/test-utils/session-state-cleanup.js"),
    import("../src/agents/session-write-lock.js"),
  ]);
  await cleanupSessionStateForTest();
  await drainSessionWriteLockStateForTest();
  testEnv.cleanup();
});
