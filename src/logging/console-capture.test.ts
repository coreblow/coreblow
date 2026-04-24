import { describe, it, expect } from "vitest";

describe("console-capture", () => {
  it("module exists (stub — source file mapping pending)", () => {
    expect(true).toBe(true);
  });

  it.todo("swallows EIO from stderr writes");
  it.todo("swallows EIO from original console writes");
  it.todo("prefixes console output with timestamps when enabled");
  it.todo("does not double-prefix timestamps");
  it.todo("prefixes JSON console output when timestamp prefix is enabled");
  it.todo("keeps diagnostics on stderr while runtime JSON stays on stdout");
  it.todo("rethrows non-EPIPE errors on stdout");
});
