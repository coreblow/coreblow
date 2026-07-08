import type { CoreBlowConfig } from "coreblow/plugin-sdk/config-runtime";
import type { RuntimeEnv } from "coreblow/plugin-sdk/runtime-env";
import type { Mock } from "vitest";
import { expect, vi } from "vitest";

type NativeCommandSpecMock = {
  name: string;
  description: string;
  acceptsArgs: boolean;
};

type PluginCommandSpecMock = {
  name: string;
  description: string;
  acceptsArgs: boolean;
};

type ProviderMonitorTestMocks = {
  clientDeployCommandsMock: Mock<(options?: { mode?: string }) => Promise<void>>;
  clientFetchUserMock: Mock<(target: string) => Promise<{ id: string }>>;
  clientGetPluginMock: Mock<(name: string) => unknown>;
  clientConstructorOptionsMock: Mock<(options?: unknown) => void>;
  createDiscordAutoPresenceControllerMock: Mock<() => unknown>;
  createDiscordExecApprovalButtonContextMock: Mock<
    (params?: {
      cfg?: CoreBlowConfig;
      accountId?: string;
      config?: unknown;
      gatewayUrl?: string;
    }) => { getApprovers: () => string[]; resolveApproval: () => Promise<boolean> }
  >;
  createNoopThreadBindingManagerMock: Mock<() => unknown>;
  createThreadBindingManagerMock: Mock<() => unknown>;
  reconcileAcpThreadBindingsOnStartupMock: Mock<() => Promise<void>>;
  getAcpSessionStatusMock: Mock<() => unknown>;
  isNativeCommandsExplicitlyDisabledMock: Mock<() => boolean>;
  resolveNativeCommandsEnabledMock: Mock<() => boolean>;
  resolveNativeSkillsEnabledMock: Mock<() => boolean>;
  isVerboseMock: Mock<() => boolean>;
  shouldLogVerboseMock: Mock<() => boolean>;
  listNativeCommandSpecsForConfigMock: Mock<() => NativeCommandSpecMock[]>;
  listSkillCommandsForAgentsMock: Mock<() => PluginCommandSpecMock[]>;
  resolveDiscordAccountMock: Mock<() => unknown>;
  resolveDiscordAllowlistConfigMock: Mock<() => unknown>;
  monitorLifecycleMock: Mock<() => Promise<void>>;
  createExecApprovalButtonMock: Mock<() => unknown>;
  createDiscordMessageHandlerMock: Mock<() => unknown>;
  createDiscordNativeCommandMock: Mock<() => unknown>;
};

const mocks = vi.hoisted(
  (): ProviderMonitorTestMocks => ({
    clientDeployCommandsMock: vi.fn(async () => {}),
    clientFetchUserMock: vi.fn(async () => ({ id: "bot-user-id" })),
    clientGetPluginMock: vi.fn(() => undefined),
    clientConstructorOptionsMock: vi.fn(),
    createDiscordAutoPresenceControllerMock: vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      update: vi.fn(),
    })),
    createDiscordExecApprovalButtonContextMock: vi.fn(() => ({
      getApprovers: () => [],
      resolveApproval: async () => false,
    })),
    createNoopThreadBindingManagerMock: vi.fn(() => ({
      reconcile: vi.fn(),
      stop: vi.fn(),
    })),
    createThreadBindingManagerMock: vi.fn(() => ({
      reconcile: vi.fn(),
      stop: vi.fn(),
    })),
    reconcileAcpThreadBindingsOnStartupMock: vi.fn(async () => {}),
    getAcpSessionStatusMock: vi.fn(() => undefined),
    isNativeCommandsExplicitlyDisabledMock: vi.fn(() => false),
    resolveNativeCommandsEnabledMock: vi.fn(() => true),
    resolveNativeSkillsEnabledMock: vi.fn(() => false),
    isVerboseMock: vi.fn(() => false),
    shouldLogVerboseMock: vi.fn(() => false),
    listNativeCommandSpecsForConfigMock: vi.fn(() => []),
    listSkillCommandsForAgentsMock: vi.fn(() => []),
    resolveDiscordAccountMock: vi.fn(() => ({
      token: "test-token",
      guilds: {},
    })),
    resolveDiscordAllowlistConfigMock: vi.fn(() => ({})),
    monitorLifecycleMock: vi.fn(async () => {}),
    createExecApprovalButtonMock: vi.fn(() => ({ button: true })),
    createDiscordMessageHandlerMock: vi.fn(() => vi.fn()),
    createDiscordNativeCommandMock: vi.fn(() => ({ execute: vi.fn() })),
  }),
);

export const {
  clientDeployCommandsMock,
  clientFetchUserMock,
  clientGetPluginMock,
  clientConstructorOptionsMock,
  createDiscordAutoPresenceControllerMock,
  createDiscordExecApprovalButtonContextMock,
  createNoopThreadBindingManagerMock,
  createThreadBindingManagerMock,
  reconcileAcpThreadBindingsOnStartupMock,
  getAcpSessionStatusMock,
  isNativeCommandsExplicitlyDisabledMock,
  resolveNativeCommandsEnabledMock,
  isVerboseMock,
  shouldLogVerboseMock,
  listNativeCommandSpecsForConfigMock,
  listSkillCommandsForAgentsMock,
  resolveDiscordAccountMock,
  resolveDiscordAllowlistConfigMock,
  monitorLifecycleMock,
  createExecApprovalButtonMock,
  createDiscordMessageHandlerMock,
  createDiscordNativeCommandMock,
} = mocks;

const { resolveNativeSkillsEnabledMock } = mocks;

function buildDiscordSourceModuleId(relativePath: string): string {
  return `../${relativePath}`;
}

vi.mock("coreblow/plugin-sdk/acp-runtime", async () => {
  const actual = await vi.importActual<typeof import("coreblow/plugin-sdk/acp-runtime")>(
    "coreblow/plugin-sdk/acp-runtime",
  );
  return {
    ...actual,
    getAcpSessionManager: () => ({
      getSessionStatus: getAcpSessionStatusMock,
    }),
    isAcpRuntimeError: (error: unknown): error is { code: string } =>
      error instanceof Error && "code" in error,
  };
});

vi.mock("coreblow/plugin-sdk/command-auth", async () => {
  const actual = await vi.importActual<typeof import("coreblow/plugin-sdk/command-auth")>(
    "coreblow/plugin-sdk/command-auth",
  );
  return {
    ...actual,
    listNativeCommandSpecsForConfig: listNativeCommandSpecsForConfigMock,
    listSkillCommandsForAgents: listSkillCommandsForAgentsMock,
  };
});
vi.mock("coreblow/plugin-sdk/reply-runtime", async () => {
  const actual = await vi.importActual<typeof import("coreblow/plugin-sdk/reply-runtime")>(
    "coreblow/plugin-sdk/reply-runtime",
  );
  return {
    ...actual,
    resolveTextChunkLimit: () => 2000,
  };
});

vi.mock("coreblow/plugin-sdk/native-command-config-runtime", async () => {
  const actual = await vi.importActual<
    typeof import("coreblow/plugin-sdk/native-command-config-runtime")
  >("coreblow/plugin-sdk/native-command-config-runtime");
  return {
    ...actual,
    isNativeCommandsExplicitlyDisabled: isNativeCommandsExplicitlyDisabledMock,
    resolveNativeCommandsEnabled: resolveNativeCommandsEnabledMock,
    resolveNativeSkillsEnabled: resolveNativeSkillsEnabledMock,
  };
});

vi.mock("coreblow/plugin-sdk/runtime-config-snapshot", async () => {
  const actual = await vi.importActual<
    typeof import("coreblow/plugin-sdk/runtime-config-snapshot")
  >("coreblow/plugin-sdk/runtime-config-snapshot");
  return {
    ...actual,
    getRuntimeConfig: () => ({}),
  };
});

vi.mock("coreblow/plugin-sdk/runtime-env", async () => {
  const actual = await vi.importActual<typeof import("coreblow/plugin-sdk/runtime-env")>(
    "coreblow/plugin-sdk/runtime-env",
  );
  return {
    ...actual,
    danger: (value: string) => value,
    isVerbose: isVerboseMock,
    logVerbose: vi.fn(),
    shouldLogVerbose: shouldLogVerboseMock,
    warn: (value: string) => value,
    createSubsystemLogger: () => {
      const logger = {
        child: vi.fn(() => logger),
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
      return logger;
    },
    createNonExitingRuntime: () => ({ log: vi.fn(), error: vi.fn(), exit: vi.fn() }),
  };
});

vi.mock("coreblow/plugin-sdk/error-runtime", async () => {
  const actual = await vi.importActual<typeof import("coreblow/plugin-sdk/error-runtime")>(
    "coreblow/plugin-sdk/error-runtime",
  );
  return {
    ...actual,
    formatErrorMessage: (error: unknown) => String(error),
  };
});

vi.mock(buildDiscordSourceModuleId("accounts.js"), () => ({
  resolveDiscordAccount: resolveDiscordAccountMock,
  resolveDiscordAccountAllowFrom: () => undefined,
  resolveDiscordAccountDmPolicy: () => undefined,
}));

vi.mock(buildDiscordSourceModuleId("probe.js"), () => ({
  fetchDiscordApplicationId: async () => "app-1",
  parseApplicationIdFromToken: (token: string) => {
    const segment = token.trim().split(".")[0];
    if (!segment) {
      return undefined;
    }
    try {
      const decoded = Buffer.from(segment, "base64url").toString("utf8").trim();
      return /^\d+$/.test(decoded) ? decoded : undefined;
    } catch {
      return undefined;
    }
  },
}));

vi.mock(buildDiscordSourceModuleId("token.js"), () => ({
  normalizeDiscordToken: (value?: string) => value,
}));

vi.mock(buildDiscordSourceModuleId("voice/command.js"), () => ({
  createDiscordVoiceCommand: () => ({ name: "voice-command" }),
}));

vi.mock(buildDiscordSourceModuleId("monitor/agent-components.js"), () => ({
  createAgentComponentButton: () => ({ id: "btn" }),
  createAgentSelectMenu: () => ({ id: "menu" }),
  createDiscordComponentButton: () => ({ id: "btn2" }),
  createDiscordComponentChannelSelect: () => ({ id: "channel" }),
  createDiscordComponentMentionableSelect: () => ({ id: "mentionable" }),
  createDiscordComponentModal: () => ({ id: "modal" }),
  createDiscordComponentRoleSelect: () => ({ id: "role" }),
  createDiscordComponentStringSelect: () => ({ id: "string" }),
  createDiscordComponentUserSelect: () => ({ id: "user" }),
}));

vi.mock(buildDiscordSourceModuleId("monitor/auto-presence.js"), () => ({
  createDiscordAutoPresenceController: createDiscordAutoPresenceControllerMock,
}));

vi.mock(buildDiscordSourceModuleId("monitor/commands.js"), () => ({
  resolveDiscordSlashCommandConfig: () => ({ ephemeral: false }),
}));

vi.mock(buildDiscordSourceModuleId("monitor/exec-approvals.js"), () => ({
  createExecApprovalButton: createExecApprovalButtonMock,
  createDiscordExecApprovalButtonContext: createDiscordExecApprovalButtonContextMock,
}));

vi.mock(buildDiscordSourceModuleId("monitor/gateway-plugin.js"), () => ({
  createDiscordGatewayPlugin: () => ({ id: "gateway-plugin" }),
  waitForDiscordGatewayPluginRegistration: () => undefined,
}));

vi.mock(buildDiscordSourceModuleId("monitor/listeners.js"), () => ({
  DiscordInteractionListener: function DiscordInteractionListener() {},
  DiscordMessageListener: function DiscordMessageListener() {},
  DiscordPresenceListener: function DiscordPresenceListener() {},
  DiscordReactionListener: function DiscordReactionListener() {},
  DiscordReactionRemoveListener: function DiscordReactionRemoveListener() {},
  DiscordThreadUpdateListener: function DiscordThreadUpdateListener() {},
  registerDiscordListener: vi.fn(),
}));

vi.mock(buildDiscordSourceModuleId("monitor/message-handler.js"), () => ({
  createDiscordMessageHandler: createDiscordMessageHandlerMock,
}));

vi.mock(buildDiscordSourceModuleId("monitor/native-command.js"), () => ({
  createDiscordCommandArgFallbackButton: () => ({ id: "arg-fallback" }),
  createDiscordModelPickerFallbackButton: () => ({ id: "model-fallback-btn" }),
  createDiscordModelPickerFallbackSelect: () => ({ id: "model-fallback-select" }),
  createDiscordNativeCommand: createDiscordNativeCommandMock,
}));

vi.mock(buildDiscordSourceModuleId("monitor/presence.js"), () => ({
  resolveDiscordPresenceUpdate: () => undefined,
}));

vi.mock(buildDiscordSourceModuleId("monitor/provider.allowlist.js"), () => ({
  resolveDiscordAllowlistConfig: resolveDiscordAllowlistConfigMock,
}));

vi.mock(buildDiscordSourceModuleId("monitor/provider.lifecycle.js"), () => ({
  runDiscordGatewayLifecycle: monitorLifecycleMock,
}));

vi.mock(buildDiscordSourceModuleId("monitor/rest-fetch.js"), () => ({
  resolveDiscordRestFetch: () => async () => {
    throw new Error("offline");
  },
}));

vi.mock(buildDiscordSourceModuleId("monitor/thread-bindings.js"), () => ({
  createNoopThreadBindingManager: createNoopThreadBindingManagerMock,
  createThreadBindingManager: createThreadBindingManagerMock,
  reconcileAcpThreadBindingsOnStartup: reconcileAcpThreadBindingsOnStartupMock,
  resolveThreadBindingIdleTimeoutMs: vi.fn(() => 24 * 60 * 60 * 1000),
}));

vi.mock("@buape/carbon", async () => {
  const actual = await vi.importActual<typeof import("@buape/carbon")>("@buape/carbon");
  class Client {
    rest = {
      get: vi.fn(async () => undefined),
      post: vi.fn(async () => undefined),
      put: vi.fn(async () => undefined),
      patch: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    };
    options: unknown;
    listeners: unknown[];
    constructor(options: unknown, handlers: { listeners?: unknown[] }) {
      this.options = options;
      this.listeners = handlers.listeners ?? [];
      clientConstructorOptionsMock(options);
    }
    async deployCommands(options?: { mode?: string }) {
      return await clientDeployCommandsMock(options);
    }
    async fetchUser(target: string) {
      return await clientFetchUserMock(target);
    }
    getPlugin(name: string) {
      return clientGetPluginMock(name);
    }
  }
  return { ...actual, Client, RateLimitError: class RateLimitError extends Error {} };
});

vi.mock("../internal/gateway.js", () => ({
  GatewayCloseCodes: { DisallowedIntents: 4014 },
}));

vi.mock("../internal/voice.js", () => ({
  VoicePlugin: function VoicePlugin() {},
}));

export function resetProviderMonitorTestMocks() {
  clientDeployCommandsMock.mockReset();
  clientFetchUserMock.mockReset().mockResolvedValue({ id: "bot-user-id" });
  clientGetPluginMock.mockReset();
  clientConstructorOptionsMock.mockReset();
  createDiscordAutoPresenceControllerMock.mockReset().mockReturnValue({
    start: vi.fn(),
    stop: vi.fn(),
    update: vi.fn(),
  });
  createDiscordExecApprovalButtonContextMock.mockReset().mockReturnValue({
    getApprovers: () => [],
    resolveApproval: async () => false,
  });
  createNoopThreadBindingManagerMock.mockReset().mockReturnValue({
    reconcile: vi.fn(),
    stop: vi.fn(),
  });
  createThreadBindingManagerMock.mockReset().mockReturnValue({
    reconcile: vi.fn(),
    stop: vi.fn(),
  });
  reconcileAcpThreadBindingsOnStartupMock.mockReset();
  getAcpSessionStatusMock.mockReset();
  isNativeCommandsExplicitlyDisabledMock.mockReset().mockReturnValue(false);
  resolveNativeCommandsEnabledMock.mockReset().mockReturnValue(true);
  resolveNativeSkillsEnabledMock.mockReset().mockReturnValue(false);
  isVerboseMock.mockReset().mockReturnValue(false);
  shouldLogVerboseMock.mockReset().mockReturnValue(false);
  listNativeCommandSpecsForConfigMock.mockReset().mockReturnValue([]);
  listSkillCommandsForAgentsMock.mockReset().mockReturnValue([]);
  resolveDiscordAccountMock.mockReset().mockReturnValue({ token: "test-token", guilds: {} });
  resolveDiscordAllowlistConfigMock.mockReset().mockReturnValue({});
  monitorLifecycleMock.mockReset();
  createExecApprovalButtonMock.mockReset().mockReturnValue({ button: true });
  createDiscordMessageHandlerMock.mockReset().mockReturnValue(vi.fn());
  createDiscordNativeCommandMock.mockReset().mockReturnValue({ execute: vi.fn() });
}
