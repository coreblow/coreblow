import { describe, expect, it } from "vitest";
import { buildMinimaxSpeechProvider } from "./speech-provider.js";

describe("buildMinimaxSpeechProvider", () => {
  it("exposes MiniMax speech metadata", () => {
    const provider = buildMinimaxSpeechProvider();
    expect(provider.id).toBe("minimax");
    expect(provider.models).toContain("speech-2.8-hd");
    expect(provider.voices).toContain("English_expressive_narrator");
  });
});
