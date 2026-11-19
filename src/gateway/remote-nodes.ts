/**
 * CoreBlow — Always-On Cloud / Remote Nodes 24/7 Registry & Health Probing
 *
 * Persists and coordinates local and remote 24/7 CoreBlow Gateways:
 * - Local Gateway (127.0.0.1:18789)
 * - Tailscale, VPS, Docker, SSH-tunneled gateways
 * - Live latency probing and health checks
 * - Bidirectional session sync between local Mac and 24/7 cloud nodes
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import {
  listUnifiedSessions,
  upsertUnifiedSession,
  type UnifiedSessionRecord,
} from "../sessions/unified-session-store.js";

export type RemoteNodeKind = "local" | "tailscale" | "vps" | "docker";

export interface RemoteNodeConfig {
  id: string;
  name: string;
  url: string;
  kind: RemoteNodeKind;
  bearerToken?: string;
  enabled: boolean;
  latencyMs?: number;
  healthy?: boolean;
  lastCheckedAtMs?: number;
}

export interface RemoteNodesFile {
  version: 1;
  activeNodeId?: string;
  nodes: RemoteNodeConfig[];
}

export const BUILTIN_LOCAL_NODE: Readonly<RemoteNodeConfig> = Object.freeze({
  id: "local",
  name: "Local Gateway",
  url: "http://127.0.0.1:18789",
  kind: "local",
  enabled: true,
  healthy: true,
  latencyMs: 1,
});

/**
 * Masks a bearer token for safe API responses and UI displays (tok_...xxxx).
 */
export function maskBearerToken(token?: string): string | undefined {
  if (!token) return undefined;
  const trimmed = token.trim();
  if (trimmed.length <= 8) return "••••••••";
  if (trimmed.startsWith("tok_")) {
    return `tok_...${trimmed.slice(-4)}`;
  }
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

/**
 * Resolves the absolute path to the remote nodes registry file.
 * Defaults to ~/.coreblow/nodes/remote-nodes.json (or inside COREBLOW_STATE_DIR).
 */
export function resolveRemoteNodesPath(customPath?: string): string {
  if (customPath && customPath.trim().length > 0) {
    const raw = customPath.trim();
    if (raw.startsWith("~")) {
      const home = process.env.HOME ?? os.homedir();
      return path.resolve(home, raw.slice(1).replace(/^\/+/, ""));
    }
    return path.resolve(raw);
  }

  const envPath = process.env.COREBLOW_REMOTE_NODES_PATH?.trim();
  if (envPath) {
    if (envPath.startsWith("~")) {
      const home = process.env.HOME ?? os.homedir();
      return path.resolve(home, envPath.slice(1).replace(/^\/+/, ""));
    }
    return path.resolve(envPath);
  }

  const stateDir = resolveStateDir();
  return path.join(stateDir, "nodes", "remote-nodes.json");
}

export class RemoteNodeRegistry {
  private readonly filePath: string;
  private nodesMap: Map<string, RemoteNodeConfig> = new Map();
  private activeNodeId: string = "local";

  constructor(filePath?: string) {
    this.filePath = resolveRemoteNodesPath(filePath);
    this.loadSync();
  }

  /**
   * Loads the nodes registry from disk synchronously.
   */
  private loadSync(): void {
    this.nodesMap.clear();
    // Always include built-in local node
    this.nodesMap.set(BUILTIN_LOCAL_NODE.id, { ...BUILTIN_LOCAL_NODE });

    if (!fs.existsSync(this.filePath)) {
      return;
    }

    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<RemoteNodesFile>;
      if (parsed && Array.isArray(parsed.nodes)) {
        for (const item of parsed.nodes) {
          if (item && typeof item === "object" && item.id) {
            // Keep local node URL canonical if it's the local node
            if (item.id === "local") {
              this.nodesMap.set("local", {
                ...BUILTIN_LOCAL_NODE,
                ...item,
                id: "local",
                kind: "local",
              });
            } else {
              this.nodesMap.set(item.id, {
                id: item.id,
                name: item.name || item.id,
                url: item.url.replace(/\/$/, ""),
                kind: item.kind || "vps",
                bearerToken: item.bearerToken,
                enabled: item.enabled ?? true,
                latencyMs: item.latencyMs,
                healthy: item.healthy,
                lastCheckedAtMs: item.lastCheckedAtMs,
              });
            }
          }
        }
      }
      if (parsed.activeNodeId && this.nodesMap.has(parsed.activeNodeId)) {
        this.activeNodeId = parsed.activeNodeId;
      }
    } catch {
      // Return built-in default on file parse error
    }
  }

  /**
   * Atomically saves the nodes registry to disk synchronously.
   */
  private saveSync(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const payload: RemoteNodesFile = {
      version: 1,
      activeNodeId: this.activeNodeId,
      nodes: Array.from(this.nodesMap.values()),
    };

    const json = JSON.stringify(payload, null, 2);
    const tmpFile = `${this.filePath}.tmp.${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    try {
      fs.writeFileSync(tmpFile, json, "utf-8");
      fs.renameSync(tmpFile, this.filePath);
    } catch {
      fs.writeFileSync(this.filePath, json, "utf-8");
      try {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      } catch {}
    }
  }

  /**
   * List all configured nodes with masked tokens by default.
   */
  listNodes(options?: { unmasked?: boolean }): RemoteNodeConfig[] {
    return Array.from(this.nodesMap.values()).map((node) => {
      if (options?.unmasked) {
        return { ...node };
      }
      return {
        ...node,
        bearerToken: maskBearerToken(node.bearerToken),
      };
    });
  }

  /**
   * Retrieve a specific node by ID.
   */
  getNode(id: string, options?: { unmasked?: boolean }): RemoteNodeConfig | undefined {
    const node = this.nodesMap.get(id);
    if (!node) return undefined;
    if (options?.unmasked) {
      return { ...node };
    }
    return {
      ...node,
      bearerToken: maskBearerToken(node.bearerToken),
    };
  }

  /**
   * Adds or updates a remote node in the registry.
   */
  addOrUpdateNode(node: {
    id?: string;
    name: string;
    url: string;
    kind?: RemoteNodeKind;
    bearerToken?: string;
    enabled?: boolean;
  }): RemoteNodeConfig {
    const cleanUrl = node.url.trim().replace(/\/$/, "");
    const id =
      node.id?.trim() ||
      `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    if (id === "local") {
      const existing = this.nodesMap.get("local") ?? BUILTIN_LOCAL_NODE;
      const updated: RemoteNodeConfig = {
        ...existing,
        name: node.name || existing.name,
        url: cleanUrl || existing.url,
        bearerToken: node.bearerToken !== undefined ? node.bearerToken : existing.bearerToken,
        enabled: node.enabled ?? true,
      };
      this.nodesMap.set("local", updated);
      this.saveSync();
      return { ...updated, bearerToken: maskBearerToken(updated.bearerToken) };
    }

    const existing = this.nodesMap.get(id);
    const updated: RemoteNodeConfig = {
      id,
      name: node.name.trim(),
      url: cleanUrl,
      kind: node.kind || existing?.kind || "vps",
      bearerToken: node.bearerToken !== undefined ? node.bearerToken : existing?.bearerToken,
      enabled: node.enabled ?? existing?.enabled ?? true,
      latencyMs: existing?.latencyMs,
      healthy: existing?.healthy,
      lastCheckedAtMs: existing?.lastCheckedAtMs,
    };

    this.nodesMap.set(id, updated);
    this.saveSync();
    return { ...updated, bearerToken: maskBearerToken(updated.bearerToken) };
  }

  /**
   * Removes a remote node from the registry.
   * Forbids deleting the built-in "local" node.
   */
  deleteNode(id: string): boolean {
    if (id === "local") {
      throw new Error("Cannot delete primary built-in 'local' node");
    }
    const removed = this.nodesMap.delete(id);
    if (removed) {
      if (this.activeNodeId === id) {
        this.activeNodeId = "local";
      }
      this.saveSync();
    }
    return removed;
  }

  /**
   * Sets the active node ID.
   */
  setActiveNodeId(id: string): void {
    if (this.nodesMap.has(id)) {
      this.activeNodeId = id;
      this.saveSync();
    }
  }

  /**
   * Gets the active node ID.
   */
  getActiveNodeId(): string {
    return this.activeNodeId;
  }

  /**
   * Probes the health and latency of a node (timeout 2500ms).
   */
  async probeNodeHealth(
    nodeIdOrNode: string | RemoteNodeConfig,
    timeoutMs: number = 2500,
  ): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const node =
      typeof nodeIdOrNode === "string"
        ? this.nodesMap.get(nodeIdOrNode)
        : nodeIdOrNode;

    if (!node) {
      return { healthy: false, latencyMs: -1, error: "Node not found" };
    }

    const cleanUrl = node.url.trim().replace(/\/$/, "");
    const startTime = Date.now();

    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (node.bearerToken) {
        headers["Authorization"] = `Bearer ${node.bearerToken}`;
      }

      // Try /health or /api/corehub/status
      const targetUrl = `${cleanUrl}/health`;
      const res = await fetch(targetUrl, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });

      const latencyMs = Math.max(1, Date.now() - startTime);
      const healthy = res.ok || res.status === 200 || res.status === 401;

      // Update in-memory registry & persist
      const target = this.nodesMap.get(node.id);
      if (target) {
        target.healthy = healthy;
        target.latencyMs = latencyMs;
        target.lastCheckedAtMs = Date.now();
        this.saveSync();
      }

      return { healthy, latencyMs };
    } catch (err) {
      const latencyMs = Math.max(1, Date.now() - startTime);
      const target = this.nodesMap.get(node.id);
      if (target) {
        target.healthy = false;
        target.latencyMs = latencyMs;
        target.lastCheckedAtMs = Date.now();
        this.saveSync();
      }
      return {
        healthy: false,
        latencyMs,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Synchronizes session threads bidirectionally with a target remote node.
   * Merges sessions by id + updatedAt so newer turns win and neither side loses data.
   */
  async syncSessionsWithNode(
    nodeIdOrNode: string | RemoteNodeConfig,
    localSessions: UnifiedSessionRecord[],
    options?: { timeoutMs?: number; storePath?: string },
  ): Promise<{
    ok: boolean;
    syncedCount: number;
    mergedSessions: UnifiedSessionRecord[];
    error?: string;
  }> {
    const node =
      typeof nodeIdOrNode === "string"
        ? this.nodesMap.get(nodeIdOrNode)
        : nodeIdOrNode;

    if (!node) {
      return {
        ok: false,
        syncedCount: 0,
        mergedSessions: localSessions,
        error: "Node not found",
      };
    }

    const cleanUrl = node.url.trim().replace(/\/$/, "");
    const timeoutMs = options?.timeoutMs ?? 5000;

    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      if (node.bearerToken) {
        headers["Authorization"] = `Bearer ${node.bearerToken}`;
      }

      // 1. Fetch remote sessions
      const res = await fetch(`${cleanUrl}/api/corehub/sessions`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        return {
          ok: false,
          syncedCount: 0,
          mergedSessions: localSessions,
          error: `Remote gateway returned HTTP ${res.status}`,
        };
      }

      const remoteData = (await res.json()) as { sessions?: UnifiedSessionRecord[] };
      const remoteSessions: UnifiedSessionRecord[] = Array.isArray(remoteData?.sessions)
        ? remoteData.sessions
        : [];

      // 2. Bidirectional Merge: Map by ID, compare updatedAt
      const mergedMap = new Map<string, UnifiedSessionRecord>();
      const remoteMap = new Map<string, UnifiedSessionRecord>();
      for (const r of remoteSessions) {
        remoteMap.set(r.id, r);
      }

      const sessionsToPushToRemote: UnifiedSessionRecord[] = [];

      // Process all local sessions
      for (const local of localSessions) {
        const remote = remoteMap.get(local.id);
        if (!remote) {
          // Local only -> push to remote, add to merged
          mergedMap.set(local.id, local);
          sessionsToPushToRemote.push(local);
        } else if (local.updatedAt >= remote.updatedAt) {
          // Local is newer or equal -> keep local, push to remote if local is strictly newer
          mergedMap.set(local.id, local);
          if (local.updatedAt > remote.updatedAt) {
            sessionsToPushToRemote.push(local);
          }
        } else {
          // Remote is strictly newer -> adopt remote into merged
          mergedMap.set(remote.id, remote);
        }
      }

      // Process any remote sessions not present locally
      for (const remote of remoteSessions) {
        if (!mergedMap.has(remote.id)) {
          mergedMap.set(remote.id, remote);
        }
      }

      // 3. Push newer/missing sessions to the remote gateway
      for (const sessionToPush of sessionsToPushToRemote) {
        try {
          await fetch(`${cleanUrl}/api/corehub/sessions`, {
            method: "POST",
            headers,
            body: JSON.stringify(sessionToPush),
            signal: AbortSignal.timeout(2000),
          });
        } catch {
          // Ignore individual remote push failures during bulk sync
        }
      }

      // 4. Update local session store with all merged sessions
      const mergedSessions = Array.from(mergedMap.values()).sort(
        (a, b) => b.updatedAt - a.updatedAt,
      );

      for (const session of mergedSessions) {
        upsertUnifiedSession(session, options?.storePath);
      }

      return {
        ok: true,
        syncedCount: mergedSessions.length,
        mergedSessions,
      };
    } catch (err) {
      return {
        ok: false,
        syncedCount: 0,
        mergedSessions: localSessions,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

let globalRegistry: RemoteNodeRegistry | null = null;

export function getGlobalRemoteNodeRegistry(customPath?: string): RemoteNodeRegistry {
  if (!globalRegistry || customPath) {
    const reg = new RemoteNodeRegistry(customPath);
    if (!customPath) {
      globalRegistry = reg;
    }
    return reg;
  }
  return globalRegistry;
}
