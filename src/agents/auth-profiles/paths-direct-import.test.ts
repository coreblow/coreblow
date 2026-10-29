import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { captureEnv } from "../../test-utils/env.js";
import { AUTH_STORE_VERSION } from "./constants.js";
import {
  resolveAuthStatePath,
  resolveAuthStatePathForDisplay,
  resolveAuthStorePath,
  resolveAuthStorePathForDisplay,
  resolveLegacyAuthStorePath,
} from "./path-resolve.js";
import { ensureAuthStoreFile } from "./paths.js";

describe("path-resolve helpers (direct-import coverage attribution)", () => {
  const envSnapshot = captureEnv(["COREBLOW_STATE_DIR", "OPENCLAW_STATE_DIR"]);
  let stateDir = "";

  beforeEach(async () => {
    stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-path-direct-"));
    process.env.COREBLOW_STATE_DIR = stateDir;
    process.env.OPENCLAW_STATE_DIR = stateDir;
  });

  afterEach(async () => {
    envSnapshot.restore();
    await fs.rm(stateDir, { recursive: true, force: true });
  });

  it("resolveAuthStorePath joins agentDir with the auth-profiles filename", () => {
    const agentDir = path.join(stateDir, "agents", "main", "agent");
    const resolved = resolveAuthStorePath(agentDir);
    expect(path.dirname(resolved)).toBe(agentDir);
    expect(path.basename(resolved)).toMatch(/auth-profiles/);
  });

  it("resolveAuthStorePath falls back to the default agent dir when agentDir is omitted", () => {
    const resolved = resolveAuthStorePath();
    expect(resolved.startsWith(stateDir)).toBe(true);
    expect(path.basename(resolved)).toMatch(/auth-profiles/);
  });

  it("resolveLegacyAuthStorePath joins agentDir with the legacy auth filename", () => {
    const agentDir = path.join(stateDir, "agents", "main", "agent");
    const resolved = resolveLegacyAuthStorePath(agentDir);
    expect(path.dirname(resolved)).toBe(agentDir);
    expect(path.basename(resolved)).not.toMatch(/auth-profiles/);
  });

  it("resolveLegacyAuthStorePath falls back to the default agent dir", () => {
    const resolved = resolveLegacyAuthStorePath();
    expect(resolved.startsWith(stateDir)).toBe(true);
  });

  it("resolveAuthStatePath joins agentDir with the auth-state filename", () => {
    const agentDir = path.join(stateDir, "agents", "main", "agent");
    const resolved = resolveAuthStatePath(agentDir);
    expect(path.dirname(resolved)).toBe(agentDir);
  });

  it("resolveAuthStatePath falls back to the default agent dir", () => {
    const resolved = resolveAuthStatePath();
    expect(resolved.startsWith(stateDir)).toBe(true);
  });

  it("resolveAuthStorePathForDisplay returns the resolved path for a non-tilde input", () => {
    const agentDir = path.join(stateDir, "agents", "main", "agent");
    const resolved = resolveAuthStorePathForDisplay(agentDir);
    expect(resolved.startsWith(stateDir)).toBe(true);
  });

  it("resolveAuthStorePathForDisplay preserves a tilde-rooted path unchanged", () => {
    const tildeAgentDir = "~fake-coreblow-no-expand";
    const resolved = resolveAuthStorePathForDisplay(tildeAgentDir);
    expect(resolved).toBe(path.resolve(tildeAgentDir, "auth-profiles.json"));
  });

  it("resolveAuthStatePathForDisplay returns the auth-state path for a non-tilde input", () => {
    const agentDir = path.join(stateDir, "agents", "main", "agent");
    const resolved = resolveAuthStatePathForDisplay(agentDir);
    expect(resolved).toBe(path.join(agentDir, "auth-state.json"));
  });
});

describe("ensureAuthStoreFile (direct-import coverage attribution)", () => {
  const envSnapshot = captureEnv(["COREBLOW_STATE_DIR", "OPENCLAW_STATE_DIR"]);
  let stateDir = "";

  beforeEach(async () => {
    stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-path-ensure-"));
    process.env.COREBLOW_STATE_DIR = stateDir;
    process.env.OPENCLAW_STATE_DIR = stateDir;
  });

  afterEach(async () => {
    envSnapshot.restore();
    await fs.rm(stateDir, { recursive: true, force: true });
  });

  it("creates a new auth-profiles.json when the file does not yet exist", async () => {
    const target = path.join(stateDir, "sub", "auth-profiles.json");
    ensureAuthStoreFile(target);
    const raw = await fs.readFile(target, "utf8");
    const parsed = JSON.parse(raw) as { version: number; profiles: Record<string, unknown> };
    expect(parsed.version).toBe(AUTH_STORE_VERSION);
    expect(parsed.profiles).toStrictEqual({});
  });

  it("leaves an existing auth-profiles.json unchanged", async () => {
    const target = path.join(stateDir, "auth-profiles.json");
    await fs.writeFile(
      target,
      JSON.stringify({
        version: 1,
        profiles: { canary: { type: "api_key", provider: "x", key: "k" } },
      }),
      "utf8",
    );
    ensureAuthStoreFile(target);
    const raw = await fs.readFile(target, "utf8");
    const parsed = JSON.parse(raw) as { profiles: Record<string, unknown> };
    expect(parsed.profiles.canary).toEqual({ type: "api_key", provider: "x", key: "k" });
  });
});
