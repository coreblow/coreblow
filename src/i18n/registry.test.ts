import { describe, it, expect } from "vitest";

describe("registry", () => {
  it("module exists (stub — source file mapping pending)", () => {
    expect(true).toBe(true);
  });

  it.todo("lists supported locales");
  it.todo("resolves browser locale fallbacks");
  it.todo("loads lazy locale translations from the registry");
});
