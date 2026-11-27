import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  configureGatewayRbacRuntime,
  invalidateGatewayRbacCache,
  resetGatewayRbacRuntimeForTest,
} from "../gateway/rbac-runtime.js";
import { authorizeGatewayMethod } from "../gateway/server-methods.js";
import type { GatewayClient } from "../gateway/server-methods/types.js";
import {
  formatRedactedRbacAudit,
  parseDurationToMs,
  PersistentRbacStore,
} from "./rbac-store.js";

function makeClient(params: {
  role?: string;
  scopes?: string[];
  deviceId?: string;
  clientId?: string;
  clientIp?: string;
}): GatewayClient {
  return {
    connId: "conn-rbac-test",
    clientIp: params.clientIp ?? "198.51.100.10",
    connect: {
      role: params.role ?? "operator",
      scopes: params.scopes ?? ["operator.admin"],
      client: { id: params.clientId ?? "test-cli", version: "1.0.0", platform: "darwin", mode: "cli" },
      ...(params.deviceId ? { device: { id: params.deviceId, publicKey: "pk", signature: "sig", signedAt: 1, nonce: "n" } } : {}),
    },
  } as unknown as GatewayClient;
}

describe("Persistent SQLite WAL RBAC Store & Gateway Wiring", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    resetGatewayRbacRuntimeForTest();
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempDbPath(name = "rbac.db"): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-rbac-test-"));
    tempDirs.push(dir);
    return path.join(dir, "security", name);
  }

  it("persists built-in roles, grants, revocations, and TTLs across store reloads", () => {
    const dbPath = createTempDbPath();
    const store1 = new PersistentRbacStore({ dbPath, gatewayMode: "remote" });
    expect(store1.getBootstrapMode()).toBe("remote-explicit");
    expect(store1.listRoles().map((r) => r.name)).toEqual(["admin", "operator", "owner", "viewer"]);

    store1.grantBinding({ principalId: "device:dev-1", roleName: "operator", grantedBy: "test" });
    store1.grantBinding({
      principalId: "device:dev-temp",
      roleName: "viewer",
      grantedBy: "test",
      expiresAtMs: Date.now() - 1000,
    });
    expect(() =>
      store1.grantBinding({ principalId: "device:dev-1", roleName: "nonexistent" }),
    ).toThrow(/Unknown RBAC role/);
    store1.close();

    const store2 = new PersistentRbacStore({ dbPath, gatewayMode: "remote" });
    const active = store2.listBindings();
    expect(active).toHaveLength(1);
    expect(active[0].principalId).toBe("device:dev-1");
    expect(active[0].roleName).toBe("operator");

    const allWithExpired = store2.listBindings({ includeExpired: true });
    expect(allWithExpired).toHaveLength(2);

    expect(store2.revokeBinding({ principalId: "device:dev-1", roleName: "operator" })).toBe(true);
    expect(store2.listBindings()).toHaveLength(0);
    store2.close();
  });

  it("bootstraps single-user local owner migration without locking out local operators", () => {
    const dbPath = createTempDbPath();
    configureGatewayRbacRuntime({ mode: "enforced", gatewayMode: "local", dbPath });

    const localClient = makeClient({
      deviceId: "local-mac-1",
      clientIp: "127.0.0.1",
      scopes: ["operator.admin"],
    });
    expect(authorizeGatewayMethod("config.set", localClient)).toBeNull();
  });

  it("enforces fail-closed RBAC in Gateway authorizeGatewayMethod across viewer, grant, revoke, and node", () => {
    const dbPath = createTempDbPath();
    const store = new PersistentRbacStore({ dbPath, gatewayMode: "remote" });
    store.grantBinding({ principalId: "device:viewer-1", roleName: "viewer" });
    store.close();

    configureGatewayRbacRuntime({ mode: "enforced", gatewayMode: "remote", dbPath });

    // 1. Unbound principal -> denied
    const unbound = makeClient({ deviceId: "unbound-1", clientIp: "198.51.100.55" });
    const unboundErr = authorizeGatewayMethod("status", unbound);
    expect(unboundErr?.message).toContain("rbac denied");

    // 2. Viewer -> status allowed, config.set denied
    const viewer = makeClient({ deviceId: "viewer-1", clientIp: "198.51.100.56" });
    expect(authorizeGatewayMethod("status", viewer)).toBeNull();
    const viewerConfigErr = authorizeGatewayMethod("config.set", viewer);
    expect(viewerConfigErr?.message).toContain("rbac denied");

    // 3. Grant admin -> config.set allowed
    const adminStore = new PersistentRbacStore({ dbPath, gatewayMode: "remote" });
    adminStore.grantBinding({ principalId: "device:viewer-1", roleName: "admin" });
    adminStore.close();
    invalidateGatewayRbacCache();
    expect(authorizeGatewayMethod("config.set", viewer)).toBeNull();

    // 4. Revoke admin -> config.set denied again
    const revokeStore = new PersistentRbacStore({ dbPath, gatewayMode: "remote" });
    revokeStore.revokeBinding({ principalId: "device:viewer-1", roleName: "admin" });
    revokeStore.close();
    invalidateGatewayRbacCache();
    expect(authorizeGatewayMethod("config.set", viewer)?.message).toContain("rbac denied");

    // 5. Node role cannot escalate to operator config.set
    const nodeClient = makeClient({ role: "node", deviceId: "node-1", scopes: [] });
    expect(authorizeGatewayMethod("config.set", nodeClient)?.message).toContain("unauthorized role");
  });

  it("fails closed when rbac.db is corrupt/unreadable in enforced mode", () => {
    const dbPath = createTempDbPath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, "NOT_A_VALID_SQLITE_FILE", "utf8");

    configureGatewayRbacRuntime({ mode: "enforced", gatewayMode: "remote", dbPath });
    const client = makeClient({ deviceId: "any-1" });
    expect(authorizeGatewayMethod("health", client)).toBeNull();
    expect(authorizeGatewayMethod("status", client)?.message).toContain("rbac denied");
  });

  it("parses TTL durations and redacts sensitive tokens in RBAC audit output", () => {
    expect(parseDurationToMs("30m")).toBe(1_800_000);
    expect(parseDurationToMs("2h")).toBe(7_200_000);
    const redacted = formatRedactedRbacAudit(
      "RBAC deny principal=device:d1 token=sk-ant-api03-1234567890abcdef1234567890",
    );
    expect(redacted).not.toContain("1234567890abcdef");
  });
});
