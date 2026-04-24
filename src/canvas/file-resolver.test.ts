/**
 * canvas/file-resolver.test.ts
 * Tests for canvas file resolver — path normalization, safety, sanitization.
 */
import { describe, expect, it } from "vitest";
import { normalizeUrlPath, isPathSafe, sanitizeFilename, PathTraversalError } from "./file-resolver.js";

describe("normalizeUrlPath", () => {
  it("normalizes simple paths", () => {
    expect(normalizeUrlPath("/index.html")).toBe("/index.html");
    expect(normalizeUrlPath("/a/b/c")).toBe("/a/b/c");
  });

  it("adds leading slash", () => {
    expect(normalizeUrlPath("file.txt")).toBe("/file.txt");
  });

  it("strips query strings and fragments", () => {
    expect(normalizeUrlPath("/page?q=1")).toBe("/page");
    expect(normalizeUrlPath("/page#section")).toBe("/page");
    expect(normalizeUrlPath("/page?q=1#s")).toBe("/page");
  });

  it("throws on null byte injection", () => {
    expect(() => normalizeUrlPath("/file\0.txt")).toThrow(PathTraversalError);
  });

  it("resolves relative segments", () => {
    expect(normalizeUrlPath("/a/../b")).toBe("/b");
    expect(normalizeUrlPath("/a/./b")).toBe("/a/b");
  });
});

describe("isPathSafe", () => {
  it("accepts safe paths", () => {
    expect(isPathSafe("file.txt")).toBe(true);
    expect(isPathSafe("a/b/c.js")).toBe(true);
    expect(isPathSafe("/absolute/path")).toBe(true);
  });

  it("rejects null byte paths", () => {
    expect(isPathSafe("file\0.txt")).toBe(false);
  });

  it("rejects traversal paths", () => {
    expect(isPathSafe("../etc/passwd")).toBe(false);
    expect(isPathSafe("a/../../etc")).toBe(false);
  });
});

describe("sanitizeFilename", () => {
  it("returns safe filenames unchanged", () => {
    expect(sanitizeFilename("report.pdf")).toBe("report.pdf");
    expect(sanitizeFilename("my-file_2024.txt")).toBe("my-file_2024.txt");
  });

  it("strips path separators", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("_.._etc_passwd");
  });

  it("strips dangerous characters", () => {
    expect(sanitizeFilename('file<>:"|?*.txt')).toBe("file_______.txt");
  });

  it("removes leading dots", () => {
    expect(sanitizeFilename(".hidden")).toBe("hidden");
    expect(sanitizeFilename("..secret")).toBe("secret");
  });

  it("limits filename length", () => {
    const longName = "a".repeat(300) + ".txt";
    expect(sanitizeFilename(longName).length).toBeLessThanOrEqual(200);
  });

  it("prefixes reserved Windows names", () => {
    expect(sanitizeFilename("CON")).toBe("_CON");
    expect(sanitizeFilename("NUL.txt")).toBe("_NUL.txt");
    expect(sanitizeFilename("COM1")).toBe("_COM1");
  });

  it("returns 'unnamed' for empty input", () => {
    expect(sanitizeFilename("")).toBe("unnamed");
    expect(sanitizeFilename("...")).toBe("unnamed");
  });

  it("removes null bytes", () => {
    expect(sanitizeFilename("file\0name.txt")).toBe("filename.txt");
  });
});

describe("PathTraversalError", () => {
  it("has correct name and message", () => {
    const error = new PathTraversalError("test");
    expect(error.name).toBe("PathTraversalError");
    expect(error.message).toBe("Path traversal blocked: test");
    expect(error).toBeInstanceOf(Error);
  });
});
