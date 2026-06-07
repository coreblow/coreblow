import { describe, expect, it } from "vitest";
import {
  migrateElevenLabsLegacyTalkConfig,
  resolveElevenLabsApiKeyWithProfileFallback,
} from "./config-compat.js";

describe("migrateElevenLabsLegacyTalkConfig", () => {
  it("moves legacy talk fields into the ElevenLabs provider config", () => {
    const result = migrateElevenLabsLegacyTalkConfig({
      talk: {
        voiceId: "EXAVITQu4vr4xnSDxMaL",
        modelId: "eleven_multilingual_v2",
      },
    });

    expect(result.changes).toHaveLength(1);
    expect(result.config).toEqual({
      talk: {
        providers: {
          elevenlabs: {
            voiceId: "EXAVITQu4vr4xnSDxMaL",
            modelId: "eleven_multilingual_v2",
          },
        },
      },
    });
  });

  it("uses env before profile fallback for the API key", () => {
    const key = resolveElevenLabsApiKeyWithProfileFallback(
      { ELEVENLABS_API_KEY: " env-key " } as NodeJS.ProcessEnv,
      {},
    );

    expect(key).toBe("env-key");
  });
});
