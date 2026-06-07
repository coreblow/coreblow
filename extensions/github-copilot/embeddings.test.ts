import { describe, expect, it } from "vitest";
import { githubCopilotMemoryEmbeddingProviderAdapter } from "./embeddings.js";

describe("githubCopilotMemoryEmbeddingProviderAdapter", () => {
  it("registers the expected adapter metadata", () => {
    expect(githubCopilotMemoryEmbeddingProviderAdapter.id).toBe("github-copilot");
    expect(githubCopilotMemoryEmbeddingProviderAdapter.transport).toBe("remote");
    expect(githubCopilotMemoryEmbeddingProviderAdapter.autoSelectPriority).toBe(15);
    expect(githubCopilotMemoryEmbeddingProviderAdapter.allowExplicitWhenConfiguredAuto).toBe(true);
  });

  it("continues auto-selection for Copilot setup failures", () => {
    expect(
      githubCopilotMemoryEmbeddingProviderAdapter.shouldContinueAutoSelection?.(
        new Error("No GitHub token available"),
      ),
    ).toBe(true);
  });
});
