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
  it("reports availability for daytona/e2b only when API keys are set and keeps modal/vercel fail-closed", async () => {
    savedEnv.DAYTONA_API_KEY = process.env.DAYTONA_API_KEY;
    savedEnv.E2B_API_KEY = process.env.E2B_API_KEY;
    delete process.env.DAYTONA_API_KEY;
    delete process.env.E2B_API_KEY;

    const withoutKeys = new Map((await listAvailableBackends()).map((b) => [b.id, b]));
    expect(withoutKeys.get("daytona")?.available).toBe(false);
    expect(withoutKeys.get("e2b")?.available).toBe(false);

    setCloudEnvVars();
    const backends = await listAvailableBackends();
    expect(backends).toHaveLength(8);

    const byId = new Map(backends.map((b) => [b.id, b]));
    expect(byId.get("local")?.available).toBe(true);
    expect(byId.get("vm_isolate")?.available).toBe(true);
    expect(byId.get("daytona")?.available).toBe(true);
    expect(byId.get("e2b")?.available).toBe(true);

    for (const cloudId of ["modal", "vercel"] as const) {
      const entry = byId.get(cloudId);
      expect(entry?.available).toBe(false);
      expect(entry?.detail).toContain("not yet implemented");
    }
  });

  it("executes daytona and e2b via REST lifecycle when API keys and fetchImpl are provided", async () => {
    setCloudEnvVars();
    const destroyed: string[] = [];
    const mockFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (method === "POST" && url.endsWith("/sandboxes")) {
        return new Response(JSON.stringify({ id: "sb-exec-1", sandboxID: "sb-exec-1" }), { status: 200 });
      }
      if (method === "POST" && (url.endsWith("/exec") || url.endsWith("/commands"))) {
        return new Response(JSON.stringify({ exitCode: 0, stdout: "cloud-ok" }), { status: 200 });
      }
      if (method === "DELETE") {
        destroyed.push(url);
        return new Response(null, { status: 204 });
      }
      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    for (const cloudId of ["daytona", "e2b"] as const) {
      const res = await executeOnBackend({
        backend: cloudId,
        command: "echo cloud-ok",
        fetchImpl: mockFetch,
      });
      expect(res.success).toBe(true);
      expect(res.exitCode).toBe(0);
      expect(res.backend).toBe(cloudId);
      expect(res.output).toBe("cloud-ok");
    }
    expect(destroyed).toHaveLength(2);
  });

  it("fails closed for modal and vercel even when API tokens are set", async () => {
    setCloudEnvVars();
    for (const cloudId of ["modal", "vercel"] as const) {
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
