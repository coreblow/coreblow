import { describe, expect, it, vi } from "vitest";

vi.mock("coreblow/plugin-sdk/provider-auth-runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("coreblow/plugin-sdk/provider-auth-runtime")>();
  return {
    ...actual,
    resolveApiKeyForProvider: vi.fn(async () => {
      throw new Error('No API key found for provider "lmstudio".');
    }),
  };
});

import {
  configureLmstudioNonInteractive,
  discoverLmstudioProvider,
  prepareLmstudioDynamicModels,
  promptAndConfigureLmstudioInteractive,
} from "./setup.js";

describe("lmstudio setup facade", () => {
  it("exports the CoreBlow-native setup and discovery helpers", () => {
    expect(configureLmstudioNonInteractive).toBeTypeOf("function");
    expect(discoverLmstudioProvider).toBeTypeOf("function");
    expect(prepareLmstudioDynamicModels).toBeTypeOf("function");
    expect(promptAndConfigureLmstudioInteractive).toBeTypeOf("function");
  });

  it("skips unconfigured LM Studio during implicit discovery without throwing API key errors", async () => {
    await expect(
      discoverLmstudioProvider({
        config: {},
        env: { VITEST: "true" },
        resolveProviderApiKey: () => ({}),
      } as never),
    ).resolves.toBeNull();

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:1234"));
    try {
      await expect(
        discoverLmstudioProvider({
          config: {},
          env: { NODE_ENV: "production" },
          resolveProviderApiKey: () => ({}),
        } as never),
      ).resolves.toBeNull();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
