import { describe, expect, it } from "vitest";
import { looksLikeLocalInstallSpec } from "./install-spec.js";

const suffixes = [".tgz", ".tar.gz", ".zip"] as const;

describe("looksLikeLocalInstallSpec()", () => {
  it("returns true for relative path starting with '.'", () => {
    expect(looksLikeLocalInstallSpec("./my-plugin", suffixes)).toBe(true);
  });

  it("returns true for home-relative path starting with '~'", () => {
    expect(looksLikeLocalInstallSpec("~/plugins/my-plugin", suffixes)).toBe(true);
  });

  it("returns true for absolute path", () => {
    expect(looksLikeLocalInstallSpec("/usr/local/plugins/pkg", suffixes)).toBe(true);
  });

  it("returns true for spec ending with known suffix .tgz", () => {
    expect(looksLikeLocalInstallSpec("my-plugin.tgz", suffixes)).toBe(true);
  });

  it("returns true for spec ending with .tar.gz", () => {
    expect(looksLikeLocalInstallSpec("archive.tar.gz", suffixes)).toBe(true);
  });

  it("returns false for npm package name", () => {
    expect(looksLikeLocalInstallSpec("my-package", suffixes)).toBe(false);
  });

  it("returns false for scoped npm package", () => {
    expect(looksLikeLocalInstallSpec("@scope/my-package", suffixes)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(looksLikeLocalInstallSpec("", suffixes)).toBe(false);
  });
});
