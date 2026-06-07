import { describe, expect, it } from "vitest";
import { DEFAULT_OLLAMA_EMBEDDING_MODEL } from "./embedding-provider.js";

describe("ollama embedding provider", () => {
  it("exports the default embedding model", () => {
    expect(DEFAULT_OLLAMA_EMBEDDING_MODEL).toContain("embed");
  });
});
