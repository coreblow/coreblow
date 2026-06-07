import { describe, expect, it, vi } from "vitest";
import plugin from "./index.js";

describe("github-copilot plugin", () => {
  it("registers provider and embedding provider", () => {
    const registerProvider = vi.fn();
    const registerMemoryEmbeddingProvider = vi.fn();

    plugin.register({
      registerProvider,
      registerMemoryEmbeddingProvider,
    } as never);

    expect(registerProvider).toHaveBeenCalledTimes(1);
    expect(registerMemoryEmbeddingProvider).toHaveBeenCalledTimes(1);
    expect(registerProvider.mock.calls[0]?.[0]).toMatchObject({
      id: "github-copilot",
    });
  });
});
