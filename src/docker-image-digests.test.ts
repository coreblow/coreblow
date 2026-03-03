import { describe, it, expect } from "vitest";

describe("docker-image-digests", () => {
  it("module exists (stub — source file mapping pending)", () => {
    expect(true).toBe(true);
  });

  it.todo("pins selected Dockerfile FROM lines to immutable sha256 digests");
  it.todo("keeps Dependabot Docker updates enabled for root Dockerfiles");
});
