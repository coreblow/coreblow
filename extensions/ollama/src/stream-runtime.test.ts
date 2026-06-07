import { describe, expect, it } from "vitest";
import { resolveConfiguredOllamaProviderConfig } from "./stream.js";

describe("ollama stream runtime", () => {
  it("resolves provider config by normalized id", () => {
    const config = {
      models: {
        providers: {
          "Ollama Local": { baseUrl: "http://localhost:11434", models: [] },
        },
      },
    };
    expect(resolveConfiguredOllamaProviderConfig({ config, providerId: "Ollama Local" })?.baseUrl)
      .toBe("http://localhost:11434");
  });
});
