import type { StreamFn } from "@mariozechner/pi-agent-core";
import { resolveTranscriptPolicy } from "../../src/agents/transcript-policy.js";
import { registerSingleProviderPlugin } from "../../test/helpers/extensions/plugin-registration.js";
import { describe, expect, it } from "vitest";
import plugin from "./index.js";
import { createKimiWebSearchProvider } from "./src/kimi-web-search-provider.runtime.js";

type MoonshotManifest = {
  providerAuthEnvVars?: Record<string, string[]>;
};

describe("moonshot provider plugin", () => {
  it("mirrors Kimi web-search env credentials in manifest metadata", async () => {
    const manifest = (await import("./coreblow.plugin.json", { with: { type: "json" } }))
      .default as MoonshotManifest;

    expect([...(manifest.providerAuthEnvVars?.moonshot ?? [])].toSorted()).toStrictEqual(
      [...createKimiWebSearchProvider().envVars].toSorted(),
    );
  });

  it("keeps CoreBlow replay validation wired for OpenAI-compatible Kimi models", () => {
    const provider = registerSingleProviderPlugin(plugin);
    const policy = resolveTranscriptPolicy({
      provider: provider.id,
      modelApi: "openai-completions",
      modelId: "kimi-k2.6",
    });

    expect(policy).toMatchObject({
      sanitizeToolCallIds: true,
      toolCallIdMode: "strict",
      validateGeminiTurns: true,
      validateAnthropicTurns: true,
      dropThinkingBlocks: false,
    });
  });

  it("wires moonshot-thinking stream hooks", () => {
    const provider = registerSingleProviderPlugin(plugin);
    let capturedPayload: Record<string, unknown> | undefined;
    const baseStreamFn: StreamFn = (_model, _context, options) => {
      const payload: Record<string, unknown> = {};
      options?.onPayload?.(payload as never, {} as never);
      capturedPayload = payload;
      return {} as ReturnType<StreamFn>;
    };

    const wrapped = provider.wrapStreamFn?.({
      provider: "moonshot",
      modelId: "kimi-k2.6",
      thinkingLevel: "off",
      streamFn: baseStreamFn,
    } as never);

    wrapped?.(
      {
        api: "openai-completions",
        provider: "moonshot",
        id: "kimi-k2.6",
      } as never,
      {} as never,
      {},
    );

    expect(capturedPayload).toEqual({
      thinking: { type: "disabled" },
    });
  });
});
