import { type Mock, vi } from "vitest";
import type { CoreBlowConfig } from "../config/types.js";

export interface StatusScanSharedMocks {
  resolveConfigPath: Mock;
  hasPotentialConfiguredChannels: Mock;
  readBestEffortConfig: Mock;
  resolveCommandSecretRefsViaGateway: Mock;
  getUpdateCheckResult: Mock;
  getAgentLocalStatuses: Mock;
  getStatusSummary: Mock;
  getMemorySearchManager: Mock;
  buildGatewayConnectionDetails: Mock;
  probeGateway: Mock;
  resolveGatewayProbeAuthResolution: Mock;
  ensurePluginRegistryLoaded: Mock;
  buildPluginCompatibilityNotices: Mock;
}

export function createStatusScanSharedMocks(configPathLabel: string): StatusScanSharedMocks {
  return {
    resolveConfigPath: vi.fn(() => `/tmp/coreblow-${configPathLabel}-missing-${process.pid}.json`),
    hasPotentialConfiguredChannels: vi.fn(),
    readBestEffortConfig: vi.fn(),
    resolveCommandSecretRefsViaGateway: vi.fn(),
    getUpdateCheckResult: vi.fn(),
    getAgentLocalStatuses: vi.fn(),
    getStatusSummary: vi.fn(),
    getMemorySearchManager: vi.fn(),
    buildGatewayConnectionDetails: vi.fn(),
    probeGateway: vi.fn(),
    resolveGatewayProbeAuthResolution: vi.fn(),
    ensurePluginRegistryLoaded: vi.fn(),
    buildPluginCompatibilityNotices: vi.fn(() => []),
  };
}

export function createStatusOsSummaryModuleMock(): { resolveOsSummary: Mock } {
  return {
    resolveOsSummary: vi.fn(() => ({ label: "test-os" })),
  };
}

export function createStatusScanDepsRuntimeModuleMock(
  mocks: Pick<StatusScanSharedMocks, "getMemorySearchManager">,
): { getTailnetHostname: Mock; getMemorySearchManager: Mock } {
  return {
    getTailnetHostname: vi.fn(),
    getMemorySearchManager: mocks.getMemorySearchManager,
  };
}

export function createStatusGatewayProbeModuleMock(
  mocks: Pick<StatusScanSharedMocks, "resolveGatewayProbeAuthResolution">,
): { pickGatewaySelfPresence: Mock; resolveGatewayProbeAuthResolution: Mock } {
  return {
    pickGatewaySelfPresence: vi.fn(() => null),
    resolveGatewayProbeAuthResolution: mocks.resolveGatewayProbeAuthResolution,
  };
}

export function createStatusGatewayCallModuleMock(
  mocks: Pick<StatusScanSharedMocks, "buildGatewayConnectionDetails"> & {
    callGateway?: unknown;
  },
): Record<string, unknown> {
  return {
    buildGatewayConnectionDetails: mocks.buildGatewayConnectionDetails,
    ...(mocks.callGateway ? { callGateway: mocks.callGateway } : {}),
  };
}

export function createStatusPluginRegistryModuleMock(
  mocks: Pick<StatusScanSharedMocks, "ensurePluginRegistryLoaded">,
): { ensurePluginRegistryLoaded: Mock } {
  return {
    ensurePluginRegistryLoaded: mocks.ensurePluginRegistryLoaded,
  };
}

export function createStatusPluginStatusModuleMock(
  mocks: Pick<StatusScanSharedMocks, "buildPluginCompatibilityNotices">,
): { buildPluginCompatibilityNotices: Mock } {
  return {
    buildPluginCompatibilityNotices: mocks.buildPluginCompatibilityNotices,
  };
}

export function createStatusUpdateModuleMock(
  mocks: Pick<StatusScanSharedMocks, "getUpdateCheckResult">,
): { getUpdateCheckResult: Mock } {
  return {
    getUpdateCheckResult: mocks.getUpdateCheckResult,
  };
}

export function createStatusAgentLocalModuleMock(
  mocks: Pick<StatusScanSharedMocks, "getAgentLocalStatuses">,
): { getAgentLocalStatuses: Mock } {
  return {
    getAgentLocalStatuses: mocks.getAgentLocalStatuses,
  };
}

export function createStatusSummaryModuleMock(
  mocks: Pick<StatusScanSharedMocks, "getStatusSummary">,
): { getStatusSummary: Mock } {
  return {
    getStatusSummary: mocks.getStatusSummary,
  };
}

export function createStatusExecModuleMock(): { runExec: Mock } {
  return {
    runExec: vi.fn(),
  };
}

type StatusScanModuleTestMocks = StatusScanSharedMocks & {
  buildChannelsTable?: Mock;
  callGateway?: Mock;
  getStatusCommandSecretTargetIds?: Mock;
  resolveMemorySearchConfig?: Mock;
};

export async function loadStatusScanModuleForTest(
  mocks: StatusScanModuleTestMocks,
  options: {
    fastJson: true;
  },
): Promise<typeof import("./status.scan.fast-json.js")>;
export async function loadStatusScanModuleForTest(
  mocks: StatusScanModuleTestMocks,
  options?: {
    fastJson?: false;
  },
): Promise<typeof import("./status.scan.js")>;
export async function loadStatusScanModuleForTest(
  mocks: StatusScanModuleTestMocks,
  options: {
    fastJson?: boolean;
  } = {},
) {
  vi.resetModules();

  vi.doMock("../channels/config-presence.js", () => ({
    hasPotentialConfiguredChannels: mocks.hasPotentialConfiguredChannels,
  }));

  if (options.fastJson) {
    vi.doMock("../config/io.js", () => ({
      readBestEffortConfig: mocks.readBestEffortConfig,
    }));
    vi.doMock("../cli/command-secret-targets.js", () => ({
      getStatusCommandSecretTargetIds: mocks.getStatusCommandSecretTargetIds,
    }));
    vi.doMock("../agents/memory-search.js", () => ({
      resolveMemorySearchConfig: mocks.resolveMemorySearchConfig,
    }));
  } else {
    vi.doMock("../cli/progress.js", () => ({
      withProgress: vi.fn(async (_opts, run) => await run({ setLabel: vi.fn(), tick: vi.fn() })),
    }));
    vi.doMock("../config/config.js", () => ({
      readBestEffortConfig: mocks.readBestEffortConfig,
    }));
    vi.doMock("./status-all/channels.js", () => ({
      buildChannelsTable: mocks.buildChannelsTable,
    }));
    vi.doMock("./status.scan.runtime.js", () => ({
      statusScanRuntime: {
        buildChannelsTable: mocks.buildChannelsTable,
        collectChannelStatusIssues: vi.fn(() => []),
      },
    }));
  }

  vi.doMock("../config/paths.js", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../config/paths.js")>();
    return {
      ...actual,
      resolveConfigPath: mocks.resolveConfigPath,
    };
  });

  vi.doMock("../cli/command-secret-gateway.js", () => ({
    resolveCommandSecretRefsViaGateway: mocks.resolveCommandSecretRefsViaGateway,
  }));
  vi.doMock("./status.update.js", () => createStatusUpdateModuleMock(mocks));
  vi.doMock("./status.agent-local.js", () => createStatusAgentLocalModuleMock(mocks));
  vi.doMock("./status.summary.js", () => createStatusSummaryModuleMock(mocks));
  vi.doMock("../infra/os-summary.js", () => createStatusOsSummaryModuleMock());
  vi.doMock("./status.scan.deps.runtime.js", () => createStatusScanDepsRuntimeModuleMock(mocks));
  vi.doMock("../gateway/call.js", () => createStatusGatewayCallModuleMock(mocks));
  vi.doMock("../gateway/probe.js", () => ({
    probeGateway: mocks.probeGateway,
  }));
  vi.doMock("./status.gateway-probe.js", () => createStatusGatewayProbeModuleMock(mocks));
  vi.doMock("../gateway/connection-details.js", () => ({
    buildGatewayConnectionDetails: mocks.buildGatewayConnectionDetails,
    buildGatewayConnectionDetailsWithResolvers: mocks.buildGatewayConnectionDetails,
  }));
  vi.doMock("../process/exec.js", () => createStatusExecModuleMock());
  vi.doMock("../cli/plugin-registry.js", () => createStatusPluginRegistryModuleMock(mocks));
  vi.doMock("../plugins/status.js", () => createStatusPluginStatusModuleMock(mocks));

  if (options.fastJson) {
    return await import("./status.scan.fast-json.js");
  }
  return await import("./status.scan.js");
}

export function createStatusScanConfig<T extends object = CoreBlowConfig>(
  overrides: T = {} as T,
): CoreBlowConfig & T {
  return {
    session: {},
    gateway: {},
    ...overrides,
  } as CoreBlowConfig & T;
}

export function createStatusSummary(
  options: {
    linkChannel?: { linked: boolean };
    byAgent?: unknown[];
  } = {},
) {
  return {
    linkChannel: options.linkChannel,
    sessions: {
      count: 0,
      paths: [],
      defaults: {},
      recent: [],
      ...(Object.prototype.hasOwnProperty.call(options, "byAgent")
        ? { byAgent: options.byAgent ?? [] }
        : {}),
    },
  };
}

export function createStatusUpdateResult() {
  return {
    installKind: "git",
    git: null,
    registry: null,
  };
}

export function createStatusAgentLocalStatuses() {
  return {
    defaultId: "main",
    agents: [],
  };
}

export function createStatusGatewayConnection() {
  return {
    url: "ws://127.0.0.1:18789",
    urlSource: "default",
  };
}

export function createStatusGatewayProbeFailure() {
  return {
    ok: false,
    url: "ws://127.0.0.1:18789",
    connectLatencyMs: null,
    error: "timeout",
    close: null,
    health: null,
    status: null,
    presence: null,
    configSnapshot: null,
  };
}

export function createStatusMemorySearchConfig(): CoreBlowConfig {
  return createStatusScanConfig({
    agents: {
      defaults: {
        memorySearch: {
          provider: "local",
          local: { modelPath: "/tmp/model.gguf" },
          fallback: "none",
        },
      },
    },
  });
}

export function createStatusMemorySearchManager() {
  return {
    manager: {
      probeVectorAvailability: vi.fn(async () => true),
      status: vi.fn(() => ({ files: 0, chunks: 0, dirty: false })),
      close: vi.fn(async () => {}),
    },
  };
}

export function applyStatusScanDefaults(
  mocks: StatusScanSharedMocks,
  options: {
    hasConfiguredChannels?: boolean;
    sourceConfig?: CoreBlowConfig;
    resolvedConfig?: CoreBlowConfig;
    summary?: ReturnType<typeof createStatusSummary>;
    update?: ReturnType<typeof createStatusUpdateResult> | false;
    gatewayProbe?: ReturnType<typeof createStatusGatewayProbeFailure> | false;
    memoryManager?: ReturnType<typeof createStatusMemorySearchManager>;
  } = {},
) {
  const sourceConfig = options.sourceConfig ?? createStatusScanConfig();
  const resolvedConfig = options.resolvedConfig ?? sourceConfig;

  mocks.hasPotentialConfiguredChannels.mockReturnValue(options.hasConfiguredChannels ?? false);
  mocks.readBestEffortConfig.mockResolvedValue(sourceConfig);
  mocks.resolveCommandSecretRefsViaGateway.mockResolvedValue({
    resolvedConfig,
    diagnostics: [],
  });
  mocks.getAgentLocalStatuses.mockResolvedValue(createStatusAgentLocalStatuses());
  mocks.getStatusSummary.mockResolvedValue(options.summary ?? createStatusSummary());
  mocks.buildGatewayConnectionDetails.mockReturnValue(createStatusGatewayConnection());
  mocks.resolveGatewayProbeAuthResolution.mockResolvedValue({
    auth: {},
    warning: undefined,
  });
  mocks.ensurePluginRegistryLoaded.mockImplementation(() => {});
  mocks.buildPluginCompatibilityNotices.mockReturnValue([]);

  if (options.update !== false) {
    mocks.getUpdateCheckResult.mockResolvedValue(options.update ?? createStatusUpdateResult());
  }

  if (options.gatewayProbe !== false) {
    mocks.probeGateway.mockResolvedValue(options.gatewayProbe ?? createStatusGatewayProbeFailure());
  }

  if (options.memoryManager) {
    mocks.getMemorySearchManager.mockResolvedValue(options.memoryManager);
  }
}

export async function withTemporaryEnv(
  overrides: Record<string, string | undefined>,
  run: () => Promise<void>,
) {
  const previousEntries = Object.fromEntries(
    Object.keys(overrides).map((key) => [key, process.env[key]]),
  );

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    await run();
  } finally {
    for (const [key, value] of Object.entries(previousEntries)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}
