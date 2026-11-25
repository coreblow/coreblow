import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UnifiedSessionRecord } from "../sessions/unified-session-store.js";
import { maskBearerToken, RemoteNodeRegistry, BUILTIN_LOCAL_NODE } from "./remote-nodes.js";

describe("RemoteNodeRegistry", () => {
  let tmpDir: string;
  let tmpFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-nodes-test-"));
    tmpFile = path.join(tmpDir, "remote-nodes.json");
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it("always initializes with built-in primary 'local' node", () => {
    const reg = new RemoteNodeRegistry(tmpFile);
    const nodes = reg.listNodes();
    expect(nodes.length).toBe(1);
    expect(nodes[0].id).toBe("local");
    expect(nodes[0].name).toBe(BUILTIN_LOCAL_NODE.name);
    expect(nodes[0].url).toBe("http://127.0.0.1:18789");
    expect(nodes[0].kind).toBe("local");
    expect(nodes[0].enabled).toBe(true);
  });

  it("adds and updates remote nodes with token masking", () => {
    const reg = new RemoteNodeRegistry(tmpFile);

    // Add a remote VPS node
    const added = reg.addOrUpdateNode({
      name: "Frankfurt 24/7 VPS",
      url: "https://vps-frankfurt.coreblow.net:18789/",
      kind: "vps",
      bearerToken: "tok_sec_1234567890abcdef",
    });

    expect(added.id).toBeDefined();
    expect(added.name).toBe("Frankfurt 24/7 VPS");
    expect(added.url).toBe("https://vps-frankfurt.coreblow.net:18789");
    expect(added.kind).toBe("vps");
    // Token should be masked on read by default
    expect(added.bearerToken).toBe("tok_...cdef");

    // List nodes should mask tokens
    const listed = reg.listNodes();
    expect(listed.length).toBe(2);
    const vps = listed.find((n) => n.id === added.id);
    expect(vps?.bearerToken).toBe("tok_...cdef");

    // Unmasked read retrieves full token
    const unmasked = reg.getNode(added.id, { unmasked: true });
    expect(unmasked?.bearerToken).toBe("tok_sec_1234567890abcdef");

    // Update existing node
    const updated = reg.addOrUpdateNode({
      id: added.id,
      name: "Frankfurt 24/7 VPS Renamed",
      url: "https://vps-frankfurt.coreblow.net:18789",
    });
    expect(updated.name).toBe("Frankfurt 24/7 VPS Renamed");
    expect(reg.getNode(added.id)?.name).toBe("Frankfurt 24/7 VPS Renamed");
  });

  it("forbids deleting the primary 'local' node", () => {
    const reg = new RemoteNodeRegistry(tmpFile);
    expect(() => reg.deleteNode("local")).toThrow(/Cannot delete primary built-in 'local' node/);
  });

  it("deletes a remote node cleanly and persists changes", () => {
    const reg = new RemoteNodeRegistry(tmpFile);
    const node = reg.addOrUpdateNode({
      name: "Tailscale Node",
      url: "https://studio.tailnet.ts.net:18789",
      kind: "tailscale",
    });

    expect(reg.listNodes().length).toBe(2);
    const deleted = reg.deleteNode(node.id);
    expect(deleted).toBe(true);
    expect(reg.listNodes().length).toBe(1);
    expect(reg.getNode(node.id)).toBeUndefined();

    // Reload from disk to verify persistence
    const reloaded = new RemoteNodeRegistry(tmpFile);
    expect(reloaded.listNodes().length).toBe(1);
  });

  it("probes node health and measures latency", async () => {
    const reg = new RemoteNodeRegistry(tmpFile);
    const node = reg.addOrUpdateNode({
      name: "Probe Target",
      url: "https://remote.example.com",
      kind: "vps",
      bearerToken: "tok_test12345678",
    });

    // Mock successful fetch
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      }),
    );

    const result = await reg.probeNodeHealth(node.id);
    expect(result.healthy).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(1);

    const updatedNode = reg.getNode(node.id);
    expect(updatedNode?.healthy).toBe(true);
    expect(updatedNode?.latencyMs).toBeGreaterThanOrEqual(1);
    expect(updatedNode?.lastCheckedAtMs).toBeDefined();
    expect(global.fetch).toHaveBeenCalledWith(
      "https://remote.example.com/health",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer tok_test12345678",
        }),
      }),
    );
  });

  it("syncs session threads bidirectionally with newer updatedAt winning", async () => {
    const reg = new RemoteNodeRegistry(tmpFile);
    const node = reg.addOrUpdateNode({
      name: "Cloud Sync Node",
      url: "https://cloud.coreblow.com:18789",
      kind: "vps",
    });

    const localSessions: UnifiedSessionRecord[] = [
      {
        id: "sess_shared_1",
        title: "Shared Thread - Local Newer",
        createdAt: 1000,
        updatedAt: 5000, // Newer than remote (3000)
        surface: "desktop",
        messages: [{ id: "m1", role: "user", content: "Local latest turn", createdAt: 5000 }],
      },
      {
        id: "sess_shared_2",
        title: "Shared Thread - Remote Newer",
        createdAt: 1000,
        updatedAt: 2000, // Older than remote (6000)
        surface: "desktop",
        messages: [{ id: "m2", role: "user", content: "Local older turn", createdAt: 2000 }],
      },
      {
        id: "sess_local_only",
        title: "Local Only Thread",
        createdAt: 1000,
        updatedAt: 3000,
        surface: "desktop",
        messages: [{ id: "m3", role: "user", content: "Local unique", createdAt: 3000 }],
      },
    ];

    const remoteSessions: UnifiedSessionRecord[] = [
      {
        id: "sess_shared_1",
        title: "Shared Thread - Remote Older",
        createdAt: 1000,
        updatedAt: 3000, // Older than local (5000)
        surface: "desktop",
        messages: [{ id: "m1_rem", role: "user", content: "Remote older", createdAt: 3000 }],
      },
      {
        id: "sess_shared_2",
        title: "Shared Thread - Remote Newer",
        createdAt: 1000,
        updatedAt: 6000, // Newer than local (2000)
        surface: "desktop",
        messages: [{ id: "m2_rem", role: "user", content: "Remote latest turn", createdAt: 6000 }],
      },
      {
        id: "sess_remote_only",
        title: "Remote 24/7 VPS Thread",
        createdAt: 1000,
        updatedAt: 4000,
        surface: "desktop",
        messages: [
          { id: "m4", role: "user", content: "Created on 24/7 cloud node", createdAt: 4000 },
        ],
      },
    ];

    // Mock GET /api/corehub/sessions and POST /api/corehub/sessions
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, opts: any) => {
        if (opts?.method === "GET") {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ ok: true, sessions: remoteSessions }),
          });
        }
        if (opts?.method === "POST") {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ ok: true }),
          });
        }
        return Promise.reject(new Error("Unexpected request"));
      }),
    );

    const customStorePath = path.join(tmpDir, "sessions.json");
    const syncRes = await reg.syncSessionsWithNode(node.id, localSessions, {
      storePath: customStorePath,
    });

    expect(syncRes.ok).toBe(true);
    expect(syncRes.syncedCount).toBe(4); // sess_shared_1, sess_shared_2, sess_local_only, sess_remote_only

    const merged = syncRes.mergedSessions;
    const sess1 = merged.find((s) => s.id === "sess_shared_1");
    expect(sess1?.updatedAt).toBe(5000); // Local won because it was newer
    expect(sess1?.messages[0].content).toBe("Local latest turn");

    const sess2 = merged.find((s) => s.id === "sess_shared_2");
    expect(sess2?.updatedAt).toBe(6000); // Remote won because it was newer
    expect(sess2?.messages[0].content).toBe("Remote latest turn");

    const sessRemoteOnly = merged.find((s) => s.id === "sess_remote_only");
    expect(sessRemoteOnly).toBeDefined();
    expect(sessRemoteOnly?.title).toBe("Remote 24/7 VPS Thread");

    const sessLocalOnly = merged.find((s) => s.id === "sess_local_only");
    expect(sessLocalOnly).toBeDefined();
  });
});
