import { describe, it, expect } from "vitest";

describe("docs-link-audit", () => {
  it("module exists (stub — source file mapping pending)", () => {
    expect(true).toBe(true);
  });

  it.todo("normalizes route fragments away");
  it.todo("resolves redirects that land on anchored sections");
  it.todo("prefers a local mint binary for anchor validation");
  it.todo("falls back to pnpm dlx when mint is not on PATH");
});
