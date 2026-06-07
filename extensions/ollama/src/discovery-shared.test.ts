import { describe, expect, it } from "vitest";
import { isLocalOllamaBaseUrl, shouldUseSyntheticOllamaAuth } from "./discovery-shared.js";

describe("ollama discovery shared", () => {
  it("classifies local hosts for synthetic auth", () => {
    expect(isLocalOllamaBaseUrl("http://127.2.3.4:11434")).toBe(true);
    expect(isLocalOllamaBaseUrl("https://ollama.com")).toBe(false);
    expect(shouldUseSyntheticOllamaAuth({ baseUrl: "http://localhost:11434", models: [] })).toBe(
      true,
    );
  });
});
