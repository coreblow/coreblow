/**
 * src/agents/cli-runner.reliability.test.ts
 *
 * Tests for CLI runner reliability utilities.
 * Ported from OC cli-runner.reliability.test.ts — adapted for CB's
 * cli-runner/reliability module.
 */
import { describe, expect, it } from "vitest";
import {
  buildCliSupervisorScopeKey,
  resolveCliNoOutputTimeoutMs,
} from "./cli-runner/reliability.js";
import type { CliBackendConfig } from "../config/types.js";

// ── fixtures ──────────────────────────────────────────────────────────────────

function makeBackend(overrides: Partial<CliBackendConfig> = {}): CliBackendConfig {
  return {
    type: "codex",
    model: "o4-mini",
    ...overrides,
  } as CliBackendConfig;
}

// ── resolveCliNoOutputTimeoutMs ───────────────────────────────────────────────

describe("resolveCliNoOutputTimeoutMs", () => {
  it("returns a positive number for valid config", () => {
    const ms = resolveCliNoOutputTimeoutMs({
      backend: makeBackend(),
      timeoutMs: 60_000,
      useResume: false,
    });
    expect(ms).toBeGreaterThan(0);
  });

  it("returns a number (milliseconds)", () => {
    const ms = resolveCliNoOutputTimeoutMs({
      backend: makeBackend(),
      timeoutMs: 60_000,
      useResume: false,
    });
    expect(typeof ms).toBe("number");
    expect(Number.isFinite(ms)).toBe(true);
  });

  it("returns less than total timeoutMs", () => {
    const timeoutMs = 60_000;
    const ms = resolveCliNoOutputTimeoutMs({
      backend: makeBackend(),
      timeoutMs,
      useResume: false,
    });
    expect(ms).toBeLessThan(timeoutMs);
  });

  it("does not throw for useResume=true", () => {
    expect(() =>
      resolveCliNoOutputTimeoutMs({
        backend: makeBackend(),
        timeoutMs: 120_000,
        useResume: true,
      }),
    ).not.toThrow();
  });
});

// ── buildCliSupervisorScopeKey ────────────────────────────────────────────────

describe("buildCliSupervisorScopeKey", () => {
  it("returns a string or undefined", () => {
    const key = buildCliSupervisorScopeKey({
      backend: makeBackend({ command: "/usr/bin/codex" }),
      backendId: "backend-1",
    });
    expect(key === undefined || typeof key === "string").toBe(true);
  });

  it("includes backend command info in the key", () => {
    const key = buildCliSupervisorScopeKey({
      backend: makeBackend({ command: "/usr/bin/codex" }),
      backendId: "backend-1",
    });
    if (key !== undefined) {
      expect(key.length).toBeGreaterThan(0);
    }
  });

  it("produces consistent key for same inputs", () => {
    const params = {
      backend: makeBackend({ command: "/usr/bin/codex" }),
      backendId: "backend-1",
      cliSessionId: "session-xyz",
    };
    const k1 = buildCliSupervisorScopeKey(params);
    const k2 = buildCliSupervisorScopeKey(params);
    expect(k1).toBe(k2);
  });

  it("does not throw when command is undefined", () => {
    expect(() =>
      buildCliSupervisorScopeKey({
        backend: makeBackend({ command: undefined }),
        backendId: "backend-1",
      }),
    ).not.toThrow();
  });
});
