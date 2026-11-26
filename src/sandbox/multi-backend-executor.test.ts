import { afterEach, describe, expect, it } from "vitest";
import {
  buildDockerRunArgs,
  executeOnBackend,
  listAvailableBackends,
} from "./multi-backend-executor.js";

const CLOUD_ENV_KEYS = [
  "DAYTONA_API_KEY",
  "MODAL_TOKEN_ID",
  "VERCEL_TOKEN",
  "E2B_API_KEY",
] as const;

const savedEnv: Partial<Record<(typeof CLOUD_ENV_KEYS)[number], string | undefined>> = {};

function setCloudEnvVars() {
  for (const key of CLOUD_ENV_KEYS) {
    savedEnv[key] = process.env[key];
    process.env[key] = "test-token-value";
  }
}

afterEach(() => {
  for (const key of CLOUD_ENV_KEYS) {
    if (key in savedEnv) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
      delete savedEnv[key];
    }
  }
});

describe("multi-backend-executor", () => {
  it("reports honest availability for all 8 backends even when cloud env vars are set", async () => {
    setCloudEnvVars();
    const backends = await listAvailableBackends();
    expect(backends).toHaveLength(8);

    const byId = new Map(backends.map((b) => [b.id, b]));
    expect(byId.get("local")?.available).toBe(true);
    expect(byId.get("vm_isolate")?.available).toBe(true);

    for (const cloudId of ["daytona", "modal", "vercel", "e2b"] as const) {
      const entry = byId.get(cloudId);
      expect(entry?.available).toBe(false);
      expect(entry?.detail).toContain("not yet implemented");
    }
  });

  it("fails closed for unimplemented cloud backends even when API tokens are set", async () => {
    setCloudEnvVars();
    for (const cloudId of ["daytona", "modal", "vercel", "e2b"] as const) {
      const res = await executeOnBackend({
        backend: cloudId,
        command: "echo hello",
      });
      expect(res.success).toBe(false);
      expect(res.exitCode).toBe(127);
      expect(res.backend).toBe(cloudId);
      expect(res.error).toBe(`${cloudId.toUpperCase()}_NOT_IMPLEMENTED`);
      expect(res.output).toContain("local, vm_isolate, docker, or ssh");
    }
  });

  it("enforces --read-only and --tmpfs hardening flags in docker run args", () => {
    const args = buildDockerRunArgs("node:24-alpine", "echo ok");
    expect(args).toContain("--rm");
    expect(args).toContain("--network=none");
    expect(args).toContain("--read-only");
    expect(args).toContain("--tmpfs");
    expect(args).toContain("/tmp:rw,noexec,nosuid,size=64m");
    expect(args).toContain("--memory=256m");
    expect(args).toContain("--cpus=0.5");
  });
});
