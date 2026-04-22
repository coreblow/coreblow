/**
 * src/config/sessions/paths.test.ts
 *
 * CoreBlow — Sessions Paths Tests
 * Verifies resolveSessionTranscriptsDir, resolveDefaultSessionStorePath.
 */
import { describe, expect, it } from "vitest";
import {
  resolveSessionTranscriptsDir,
  resolveSessionTranscriptsDirForAgent,
  resolveDefaultSessionStorePath,
} from "./paths.js";

describe("resolveSessionTranscriptsDir()", () => {
  it("returns a string", () => {
    expect(typeof resolveSessionTranscriptsDir()).toBe("string");
  });

  it("returns a non-empty path", () => {
    expect(resolveSessionTranscriptsDir().length).toBeGreaterThan(0);
  });

  it("does not throw", () => {
    expect(() => resolveSessionTranscriptsDir()).not.toThrow();
  });
});

describe("resolveSessionTranscriptsDirForAgent()", () => {
  it("returns a string for undefined agentId", () => {
    expect(typeof resolveSessionTranscriptsDirForAgent(undefined)).toBe("string");
  });

  it("returns a string for specific agentId", () => {
    expect(typeof resolveSessionTranscriptsDirForAgent("my-agent")).toBe("string");
  });

  it("path differs by agentId", () => {
    const a = resolveSessionTranscriptsDirForAgent("agent-a");
    const b = resolveSessionTranscriptsDirForAgent("agent-b");
    expect(a).not.toBe(b);
  });
});

describe("resolveDefaultSessionStorePath()", () => {
  it("returns a string ending with sessions.json", () => {
    const result = resolveDefaultSessionStorePath();
    expect(result.endsWith("sessions.json")).toBe(true);
  });

  it("includes agentId when provided", () => {
    const result = resolveDefaultSessionStorePath("my-agent");
    expect(result).toContain("my-agent");
  });
});
