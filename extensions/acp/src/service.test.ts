import { beforeEach, describe, expect, it, vi , Mock } from "vitest";
import { AcpRuntimeError } from "../../../src/acp/runtime/errors.js";
import {
  __testing,
  getAcpRuntimeBackend,
  requireAcpRuntimeBackend,
} from "../../../src/acp/runtime/registry.js";
import type { AcpRuntime, CoreBlowPluginServiceContext } from "../runtime-api.js";
import { ACP_BUNDLED_BIN, ACP_PINNED_VERSION } from "./config.js";
import { createAcpRuntimeService } from "./service.js";

const { ensureAcpSpy } = vi.hoisted(() => ({
  ensureAcpSpy: vi.fn(async () => {}),
}));

vi.mock("./ensure.js", () => ({
  ensureAcp: ensureAcpSpy,
}));

type RuntimeStub = AcpRuntime & {
  probeAvailability(): Promise<void>;
  isHealthy(): boolean;
};

function createRuntimeStub(healthy: boolean): {
  runtime: RuntimeStub;
  probeAvailabilitySpy: Mock;
  isHealthySpy: Mock;
} {
  const probeAvailabilitySpy = vi.fn(async () => {});
  const isHealthySpy = vi.fn(() => healthy);
  return {
    runtime: {
      ensureSession: vi.fn(async (input) => ({
        sessionKey: input.sessionKey,
        backend: "acp",
        runtimeSessionName: input.sessionKey,
      })),
      runTurn: vi.fn(async function* () {
        yield { type: "done" as const };
      }),
      cancel: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      async probeAvailability() {
        await probeAvailabilitySpy();
      },
      isHealthy() {
        return isHealthySpy();
      },
    },
    probeAvailabilitySpy,
    isHealthySpy,
  };
}

function createServiceContext(
  overrides: Partial<CoreBlowPluginServiceContext> = {},
): CoreBlowPluginServiceContext {
  return {
    config: {},
    workspaceDir: "/tmp/workspace",
    stateDir: "/tmp/state",
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    ...overrides,
  };
}

describe("createAcpRuntimeService", () => {
  beforeEach(() => {
    __testing.resetAcpRuntimeBackendsForTests();
    ensureAcpSpy.mockReset();
    ensureAcpSpy.mockImplementation(async () => {});
  });

  it("registers and unregisters the acp backend", async () => {
    const { runtime, probeAvailabilitySpy } = createRuntimeStub(true);
    const service = createAcpRuntimeService({
      runtimeFactory: () => runtime,
    });
    const context = createServiceContext();

    await service.start(context);
    expect(getAcpRuntimeBackend("acp")?.runtime).toBe(runtime);

    await vi.waitFor(() => {
      expect(ensureAcpSpy).toHaveBeenCalledOnce();
      expect(ensureAcpSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          stripProviderAuthEnvVars: true,
        }),
      );
      expect(probeAvailabilitySpy).toHaveBeenCalledOnce();
    });

    await service.stop?.(context);
    expect(getAcpRuntimeBackend("acp")).toBeNull();
  });

  it("marks backend unavailable when runtime health check fails", async () => {
    const { runtime } = createRuntimeStub(false);
    const service = createAcpRuntimeService({
      runtimeFactory: () => runtime,
    });
    const context = createServiceContext();

    await service.start(context);

    expect(() => requireAcpRuntimeBackend("acp")).toThrowError(AcpRuntimeError);
    try {
      requireAcpRuntimeBackend("acp");
      throw new Error("expected ACP backend lookup to fail");
    } catch (error) {
      expect((error as AcpRuntimeError).code).toBe("ACP_BACKEND_UNAVAILABLE");
    }
  });

  it("passes queue-owner TTL from plugin config", async () => {
    const { runtime } = createRuntimeStub(true);
    const runtimeFactory = vi.fn(() => runtime);
    const service = createAcpRuntimeService({
      runtimeFactory,
      pluginConfig: {
        queueOwnerTtlSeconds: 0.25,
      },
    });
    const context = createServiceContext();

    await service.start(context);

    expect(runtimeFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        queueOwnerTtlSeconds: 0.25,
        pluginConfig: expect.objectContaining({
          command: ACP_BUNDLED_BIN,
          expectedVersion: ACP_PINNED_VERSION,
          allowPluginLocalInstall: true,
        }),
      }),
    );
  });

  it("uses a short default queue-owner TTL", async () => {
    const { runtime } = createRuntimeStub(true);
    const runtimeFactory = vi.fn(() => runtime);
    const service = createAcpRuntimeService({
      runtimeFactory,
    });
    const context = createServiceContext();

    await service.start(context);

    expect(runtimeFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        queueOwnerTtlSeconds: 0.1,
      }),
    );
  });

  it("does not block startup while acp ensure runs", async () => {
    const { runtime } = createRuntimeStub(true);
    ensureAcpSpy.mockImplementation(() => new Promise<void>(() => {}));
    const service = createAcpRuntimeService({
      runtimeFactory: () => runtime,
    });
    const context = createServiceContext();

    const startResult = await Promise.race([
      Promise.resolve(service.start(context)).then(() => "started"),
      new Promise<string>((resolve) => setTimeout(() => resolve("timed_out"), 100)),
    ]);

    expect(startResult).toBe("started");
    expect(getAcpRuntimeBackend("acp")?.runtime).toBe(runtime);
  });
});
