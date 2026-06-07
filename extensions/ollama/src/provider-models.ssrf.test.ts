import { describe, expect, it } from "vitest";
import { buildOllamaBaseUrlSsrFPolicy } from "./provider-models.js";

describe("ollama provider model ssrf policy", () => {
  it("allows only the configured Ollama host", () => {
    expect(buildOllamaBaseUrlSsrFPolicy("http://localhost:11434")?.hostnameAllowlist).toEqual([
      "localhost",
    ]);
    expect(buildOllamaBaseUrlSsrFPolicy("http://metadata.google.internal")).toBeUndefined();
  });
});
