import { describe, expect, it } from "vitest";
import { openrouterMediaUnderstandingProvider } from "./media-understanding-provider.js";

describe("openrouter media understanding provider", () => {
  it("advertises image understanding capability", () => {
    expect(openrouterMediaUnderstandingProvider.id).toBe("openrouter");
    expect(openrouterMediaUnderstandingProvider.capabilities).toEqual(["image"]);
    expect(openrouterMediaUnderstandingProvider.describeImage).toBeTypeOf("function");
    expect(openrouterMediaUnderstandingProvider.describeImages).toBeTypeOf("function");
  });
});
