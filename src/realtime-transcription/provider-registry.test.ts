import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyPluginRegistry, type PluginRegistry } from "../plugins/registry.js";
import type { RealtimeTranscriptionProviderPlugin } from "../plugins/types.js";

const { resolveRuntimePluginRegistryMock } = vi.hoisted(() => ({
  resolveRuntimePluginRegistryMock: vi.fn<() => PluginRegistry | undefined>(() => undefined),
}));

vi.mock("../plugins/loader.js", () => ({
  resolveRuntimePluginRegistry: resolveRuntimePluginRegistryMock,
}));

let getRealtimeTranscriptionProvider: typeof import("./provider-registry.js").getRealtimeTranscriptionProvider;
let listRealtimeTranscriptionProviders: typeof import("./provider-registry.js").listRealtimeTranscriptionProviders;

function createRealtimeProvider(
  id: string,
  aliases: string[] = [],
): RealtimeTranscriptionProviderPlugin {
  return {
    id,
    aliases,
    label: id,
    createSession: () => ({
      async connect() {},
      sendAudio() {},
      close() {},
      isConnected: () => false,
    }),
  };
}

describe("realtime-transcription provider registry", () => {
  afterEach(() => {
    resolveRuntimePluginRegistryMock.mockReset();
    resolveRuntimePluginRegistryMock.mockReturnValue(undefined);
  });

  beforeEach(async () => {
    vi.resetModules();
    ({ getRealtimeTranscriptionProvider, listRealtimeTranscriptionProviders } = await import(
      "./provider-registry.js"
    ));
  });

  it("uses active plugin providers", () => {
    const registry = createEmptyPluginRegistry();
    registry.realtimeTranscriptionProviders?.push({
      pluginId: "custom-realtime",
      pluginName: "Custom Realtime",
      source: "test",
      provider: createRealtimeProvider("custom-realtime"),
    });
    resolveRuntimePluginRegistryMock.mockReturnValue(registry);

    expect(getRealtimeTranscriptionProvider("custom-realtime")?.id).toBe("custom-realtime");
    expect(listRealtimeTranscriptionProviders().map((provider) => provider.id)).toEqual([
      "custom-realtime",
    ]);
  });

  it("ignores prototype-like provider ids and aliases", () => {
    const registry = createEmptyPluginRegistry();
    registry.realtimeTranscriptionProviders?.push(
      {
        pluginId: "blocked-realtime",
        pluginName: "Blocked Realtime",
        source: "test",
        provider: createRealtimeProvider("__proto__", ["constructor", "prototype"]),
      },
      {
        pluginId: "safe-realtime",
        pluginName: "Safe Realtime",
        source: "test",
        provider: createRealtimeProvider("safe-realtime", ["safe-alias", "constructor"]),
      },
    );
    resolveRuntimePluginRegistryMock.mockReturnValue(registry);

    expect(listRealtimeTranscriptionProviders().map((provider) => provider.id)).toEqual([
      "safe-realtime",
    ]);
    expect(getRealtimeTranscriptionProvider("__proto__")).toBeUndefined();
    expect(getRealtimeTranscriptionProvider("constructor")).toBeUndefined();
    expect(getRealtimeTranscriptionProvider("safe-alias")?.id).toBe("safe-realtime");
  });
});
