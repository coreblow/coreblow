import { describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import {
  deriveAspectRatioFromSize,
  normalizeDurationToClosestMax,
  resolveCapabilityModelCandidates,
  resolveClosestAspectRatio,
  resolveClosestResolution,
  resolveClosestSize,
  throwCapabilityGenerationFailure,
} from "./runtime-shared.js";

function parseModelRef(raw?: string) {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }
  const slash = trimmed.indexOf("/");
  if (slash <= 0 || slash === trimmed.length - 1) {
    return null;
  }
  return {
    provider: trimmed.slice(0, slash),
    model: trimmed.slice(slash + 1),
  };
}

describe("media-generation runtime shared candidates", () => {
  it("appends auth-backed provider defaults after explicit refs by default", () => {
    const candidates = resolveCapabilityModelCandidates({
      cfg: {
        agents: {
          defaults: {
            model: {
              primary: "openai/gpt-5.4",
            },
          },
        },
      } as CoreBlowConfig,
      modelConfig: {
        primary: "google/gemini-3.1-flash-image-preview",
        fallbacks: ["fal/fal-ai/flux/dev"],
      },
      parseModelRef,
      listProviders: () => [
        {
          id: "google",
          defaultModel: "gemini-3.1-flash-image-preview",
          isConfigured: () => true,
        },
        {
          id: "openai",
          defaultModel: "gpt-image-1",
          isConfigured: () => true,
        },
        {
          id: "minimax",
          defaultModel: "image-01",
          isConfigured: () => true,
        },
      ],
    });

    expect(candidates).toEqual([
      { provider: "google", model: "gemini-3.1-flash-image-preview" },
      { provider: "fal", model: "fal-ai/flux/dev" },
      { provider: "openai", model: "gpt-image-1" },
      { provider: "minimax", model: "image-01" },
    ]);
  });

  it("orders auto-detected provider defaults by canonical aliases", () => {
    const candidates = resolveCapabilityModelCandidates({
      cfg: {
        agents: {
          defaults: {
            model: {
              primary: "openai-codex/gpt-5.5",
            },
          },
        },
      } as CoreBlowConfig,
      modelConfig: undefined,
      parseModelRef,
      listProviders: () => [
        {
          id: "fal",
          defaultModel: "fal-ai/flux/dev",
          isConfigured: () => true,
        },
        {
          id: "openai",
          aliases: ["openai-codex"],
          defaultModel: "gpt-image-2",
          isConfigured: () => true,
        },
      ],
    });

    expect(candidates).toEqual([
      { provider: "openai", model: "gpt-image-2" },
      { provider: "fal", model: "fal-ai/flux/dev" },
    ]);
  });

  it("treats an explicit model override as exact-only", () => {
    const candidates = resolveCapabilityModelCandidates({
      cfg: {} as CoreBlowConfig,
      modelConfig: {
        primary: "google/gemini-3.1-flash-image-preview",
        fallbacks: ["fal/fal-ai/flux/dev"],
      },
      modelOverride: "openai/gpt-image-2",
      parseModelRef,
      listProviders: () => [
        {
          id: "google",
          defaultModel: "gemini-3.1-flash-image-preview",
          isConfigured: () => true,
        },
      ],
    });

    expect(candidates).toEqual([{ provider: "openai", model: "gpt-image-2" }]);
  });

  it("resolves slash-containing provider model IDs from registered provider models", () => {
    const candidates = resolveCapabilityModelCandidates({
      cfg: {} as CoreBlowConfig,
      modelConfig: {
        primary: "openai/gpt-image-2",
      },
      modelOverride: "fal-ai/flux/dev",
      parseModelRef,
      listProviders: () => [
        {
          id: "fal",
          defaultModel: "fal-ai/flux/dev",
          models: ["fal-ai/flux/dev", "fal-ai/flux/dev/image-to-image"],
          isConfigured: () => true,
        },
      ],
    });

    expect(candidates).toEqual([{ provider: "fal", model: "fal-ai/flux/dev" }]);
  });
});

describe("media-generation runtime shared normalization", () => {
  it("derives reduced aspect ratios from size strings", () => {
    expect(deriveAspectRatioFromSize("1280x720")).toBe("16:9");
    expect(deriveAspectRatioFromSize("1024x1536")).toBe("2:3");
  });

  it("maps unsupported sizes to the closest supported size", () => {
    expect(
      resolveClosestSize({
        requestedSize: "1792x1024",
        supportedSizes: ["1024x1024", "1024x1536", "1536x1024"],
      }),
    ).toBe("1536x1024");
  });

  it("maps unsupported aspect ratios to the closest supported aspect ratio", () => {
    expect(
      resolveClosestAspectRatio({
        requestedAspectRatio: "17:10",
        supportedAspectRatios: ["1:1", "4:3", "16:9"],
      }),
    ).toBe("16:9");
  });

  it("maps unsupported resolutions to the closest supported resolution", () => {
    expect(
      resolveClosestResolution({
        requestedResolution: "2K",
        supportedResolutions: ["1K", "4K"],
      }),
    ).toBe("1K");
  });

  it("clamps durations to the closest supported max", () => {
    expect(normalizeDurationToClosestMax(12, 8)).toBe(8);
    expect(normalizeDurationToClosestMax(6, 8)).toBe(6);
  });
});

describe("media-generation runtime shared failure summaries", () => {
  it("collapses abort cascades behind the non-abort failure", () => {
    expect(() =>
      throwCapabilityGenerationFailure({
        capabilityLabel: "music generation",
        attempts: [
          {
            provider: "google",
            model: "lyria-3-clip-preview",
            error: "deadline is too short",
          },
          {
            provider: "minimax",
            model: "music-2.6",
            error: "This operation was aborted",
          },
        ],
        lastError: new Error("This operation was aborted"),
      }),
    ).toThrow(
      "All music generation models failed (2): google/lyria-3-clip-preview: deadline is too short | 1 fallback(s) aborted after the request was cancelled or timed out: minimax/music-2.6",
    );
  });
});
