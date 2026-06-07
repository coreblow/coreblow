import { describe, expect, it } from "vitest";
import { readProviderBaseUrl } from "./provider-base-url.js";

describe("ollama provider base url", () => {
  it("reads baseURL aliases", () => {
    expect(readProviderBaseUrl({ baseURL: " http://localhost:11434/v1 ", models: [] } as never))
      .toBe("http://localhost:11434/v1");
  });
});
