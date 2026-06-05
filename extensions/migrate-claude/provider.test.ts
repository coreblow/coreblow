import { describe, expect, it } from "vitest";
import { buildClaudeMigrationProvider } from "./provider.js";

describe("Claude migration provider", () => {
  it("exports the provider descriptor", () => {
    const provider = buildClaudeMigrationProvider();
    expect(provider.id).toBe("claude");
    expect(typeof provider.detect).toBe("function");
    expect(typeof provider.plan).toBe("function");
    expect(typeof provider.apply).toBe("function");
  });
});
