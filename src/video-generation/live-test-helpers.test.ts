import { describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import {
  canRunBufferBackedImageToVideoLiveLane,
  canRunBufferBackedVideoToVideoLiveLane,
  parseCsvFilter,
  parseProviderModelMap,
  redactLiveApiKey,
  resolveConfiguredLiveVideoModels,
  resolveLiveVideoAuthStore,
  resolveLiveVideoResolution,
} from "./live-test-helpers.js";

describe("video-generation live-test helpers", () => {
  it("parses provider filters and treats empty/all as unfiltered", () => {
    expect(parseCsvFilter()).toBeNull();
    expect(parseCsvFilter("all")).toBeNull();
    expect(parseCsvFilter(" google , openai ")).toEqual(new Set(["google", "openai"]));
  });

  it("parses provider model overrides by provider id", () => {
    expect(
      parseProviderModelMap("google/veo-3.1-fast-generate-preview, openai/sora-2, invalid"),
    ).toEqual(
      new Map([
        ["google", "google/veo-3.1-fast-generate-preview"],
        ["openai", "openai/sora-2"],
      ]),
    );
  });

  it("collects configured models from primary and fallbacks", () => {
    const cfg = {
      agents: {
        defaults: {
          videoGenerationModel: {
            primary: "google/veo-3.1-fast-generate-preview",
            fallbacks: ["openai/sora-2", "invalid"],
          },
        },
      },
    } as unknown as CoreBlowConfig;

    expect(resolveConfiguredLiveVideoModels(cfg)).toEqual(
      new Map([
        ["google", "google/veo-3.1-fast-generate-preview"],
        ["openai", "openai/sora-2"],
      ]),
    );
  });

  it("uses an empty auth store when live env keys should override stale profiles", () => {
    expect(
      resolveLiveVideoAuthStore({
        requireProfileKeys: false,
        hasLiveKeys: true,
      }),
    ).toEqual({
      version: 1,
      profiles: {},
    });
  });

  it("redacts live API keys for diagnostics", () => {
    expect(redactLiveApiKey(undefined)).toBe("none");
    expect(redactLiveApiKey("short-key")).toBe("short-key");
    expect(redactLiveApiKey("sk-proj-1234567890")).toBe("sk-proj-...7890");
  });

  it("resolves provider-specific live video defaults", () => {
    expect(
      resolveLiveVideoResolution({
        providerId: "minimax",
        modelRef: "minimax/MiniMax-Hailuo-2.3",
      }),
    ).toBe("768P");
    expect(
      resolveLiveVideoResolution({
        providerId: "openrouter",
        modelRef: "openrouter/google/veo-3.1-fast",
      }),
    ).toBe("720P");
    expect(
      resolveLiveVideoResolution({
        providerId: "google",
        modelRef: "google/veo-3.1-fast-generate-preview",
      }),
    ).toBe("480P");
  });

  it("gates buffer-backed video-to-video lanes by provider/model support", () => {
    expect(
      canRunBufferBackedVideoToVideoLiveLane({
        providerId: "google",
        modelRef: "google/veo-3.1-fast-generate-preview",
      }),
    ).toBe(false);
    expect(
      canRunBufferBackedVideoToVideoLiveLane({
        providerId: "runway",
        modelRef: "runway/gen4_aleph",
      }),
    ).toBe(true);
    expect(
      canRunBufferBackedVideoToVideoLiveLane({
        providerId: "runway",
        modelRef: "runway/gen4.5",
      }),
    ).toBe(false);
  });

  it("runs buffer-backed image-to-video except for unsupported providers", () => {
    expect(
      canRunBufferBackedImageToVideoLiveLane({
        providerId: "openai",
        modelRef: "openai/sora-2",
      }),
    ).toBe(true);
    expect(
      canRunBufferBackedImageToVideoLiveLane({
        providerId: "vydra",
        modelRef: "vydra/veo3",
      }),
    ).toBe(false);
  });
});
