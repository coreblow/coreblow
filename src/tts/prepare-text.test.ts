import { describe, it, expect } from "vitest";

describe("prepare-text", () => {
  it("module exists (stub — source file mapping pending)", () => {
    expect(true).toBe(true);
  });

  it.todo("strips markdown headers before TTS");
  it.todo("strips bold and italic markers before TTS");
  it.todo("strips inline code markers before TTS");
  it.todo("handles a typical LLM reply with mixed markdown");
  it.todo("handles markdown-heavy system design explanation");
});
