import { describe, expect, it } from "vitest";
import { resolveOllamaBaseUrlForRun } from "./stream.js";

describe("ollama stream", () => {
  it("uses provider base url before model base url", () => {
    expect(
      resolveOllamaBaseUrlForRun({
        providerBaseUrl: "http://provider:11434",
        modelBaseUrl: "http://model:11434",
      }),
    ).toBe("http://provider:11434");
  });
});
