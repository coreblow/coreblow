import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resolveStateDir } from "../config/paths.js";

export type McpTransport = "stdio" | "sse" | "http";
export type McpServerStatus = "connected" | "disconnected" | "error";

export interface McpServerConfig {
  id: string;
  name: string;
  transport: McpTransport;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  enabled: boolean;
  status: McpServerStatus;
  lastCheckedAtMs?: number;
  description?: string;
}

export interface McpCatalogItem {
  id: string;
  name: string;
  description: string;
  category: "development" | "database" | "browser" | "productivity" | "utility";
  transport: McpTransport;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export interface McpServersFile {
  version: 1;
  servers: Record<string, McpServerConfig>;
}

/**
 * Curated CoreBlow MCP Catalog for 1-click installation.
 */
export const COREBLOW_MCP_CATALOG: McpCatalogItem[] = [
  {
    id: "github",
    name: "GitHub",
    description: "Inspect repositories, search code, read pull requests, and manage issues.",
    category: "development",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: "" },
  },
  {
    id: "filesystem",
    name: "Filesystem",
    description: "Read, write, and traverse local project directories sovereignly.",
    category: "utility",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", process.cwd()],
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    description: "Execute SQL queries and inspect schema in local or remote Postgres databases.",
    category: "database",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/coreblow"],
  },
  {
    id: "sqlite",
    name: "SQLite",
    description: "Inspect and query SQLite database files locally with zero configuration.",
    category: "database",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sqlite", "--db-path", path.join(os.homedir(), ".coreblow", "mcp.db")],
  },
  {
    id: "playwright",
    name: "Playwright Browser",
    description: "Headless Chromium browser automation, screenshots, and DOM inspection.",
    category: "browser",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@automata/mcp-playwright"],
  },
  {
    id: "fetch",
    name: "Web Fetch",
    description: "Fast HTTP client to fetch, parse HTML, and extract clean text from URLs.",
    category: "utility",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-fetch"],
  },
  {
    id: "memory",
    name: "Knowledge Graph Memory",
    description: "Persistent entity-relation graph memory for cross-session facts.",
    category: "productivity",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
  },
  {
    id: "linear",
    name: "Linear",
    description: "Create, search, and update Linear issues, projects, and roadmaps.",
    category: "productivity",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-linear"],
    env: { LINEAR_API_KEY: "" },
  },
  {
    id: "notion",
    name: "Notion",
    description: "Search workspace pages, read databases, and append blocks in Notion.",
    category: "productivity",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-notion"],
    env: { NOTION_API_KEY: "" },
  },
  {
    id: "slack",
    name: "Slack",
    description: "Send channel messages, read threads, and search workspace communications.",
    category: "productivity",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-slack"],
    env: { SLACK_BOT_TOKEN: "" },
  },
];

/**
 * Returns the curated CoreBlow MCP Catalog.
 */
export function getMcpCatalog(): McpCatalogItem[] {
  return [...COREBLOW_MCP_CATALOG];
}

/**
 * Resolves the path to the MCP servers configuration file.
 * Defaults to ~/.coreblow/mcp/servers.json.
 */
export function resolveMcpServersPath(customPath?: string): string {
  if (customPath && customPath.trim().length > 0) {
    const raw = customPath.trim();
    if (raw.startsWith("~")) {
      const home = process.env.HOME ?? os.homedir();
      return path.resolve(home, raw.slice(1).replace(/^\/+/, ""));
    }
    return path.resolve(raw);
  }

  const envPath = process.env.COREBLOW_MCP_SERVERS_PATH?.trim();
  if (envPath) {
    if (envPath.startsWith("~")) {
      const home = process.env.HOME ?? os.homedir();
      return path.resolve(home, envPath.slice(1).replace(/^\/+/, ""));
    }
    return path.resolve(envPath);
  }

  const stateDir = resolveStateDir();
  return path.join(stateDir, "mcp", "servers.json");
}

/**
 * Loads configured MCP servers synchronously.
 */
export function loadMcpServersSync(storePath?: string): Record<string, McpServerConfig> {
  const filePath = resolveMcpServersPath(storePath);
  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<McpServersFile>;
    if (parsed && typeof parsed === "object" && typeof parsed.servers === "object") {
      return (parsed.servers ?? {}) as Record<string, McpServerConfig>;
    }
  } catch {
    // Return empty on corrupt file
  }

  return {};
}

/**
 * Atomically saves MCP servers configuration to disk.
 */
export function saveMcpServersSync(
  servers: Record<string, McpServerConfig>,
  storePath?: string,
): void {
  const filePath = resolveMcpServersPath(storePath);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const data: McpServersFile = {
    version: 1,
    servers,
  };

  const json = JSON.stringify(data, null, 2);
  const tmpFile = `${filePath}.tmp.${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  try {
    fs.writeFileSync(tmpFile, json, "utf-8");
    fs.renameSync(tmpFile, filePath);
  } catch {
    fs.writeFileSync(filePath, json, "utf-8");
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch {}
  }
}

/**
 * Lists all configured MCP servers.
 */
export function listMcpServers(storePath?: string): McpServerConfig[] {
  const servers = loadMcpServersSync(storePath);
  return Object.values(servers);
}

/**
 * Retrieves a single MCP server by ID.
 */
export function getMcpServer(id: string, storePath?: string): McpServerConfig | undefined {
  const servers = loadMcpServersSync(storePath);
  return servers[id];
}

/**
 * Upserts an MCP server configuration.
 */
export function upsertMcpServer(
  server: Partial<McpServerConfig> & { id: string },
  storePath?: string,
): McpServerConfig {
  const servers = loadMcpServersSync(storePath);
  const id = server.id.trim();
  const existing = servers[id];

  const record: McpServerConfig = {
    id,
    name: server.name || existing?.name || id,
    transport: server.transport || existing?.transport || "stdio",
    command: server.command ?? existing?.command,
    args: server.args ?? existing?.args,
    url: server.url ?? existing?.url,
    env: server.env ?? existing?.env,
    enabled: server.enabled !== undefined ? server.enabled : (existing?.enabled ?? true),
    status: server.status || existing?.status || "disconnected",
    lastCheckedAtMs: server.lastCheckedAtMs ?? existing?.lastCheckedAtMs,
    description: server.description ?? existing?.description,
  };

  servers[id] = record;
  saveMcpServersSync(servers, storePath);
  return record;
}

/**
 * Deletes an MCP server by ID.
 */
export function deleteMcpServer(id: string, storePath?: string): boolean {
  const servers = loadMcpServersSync(storePath);
  if (servers[id]) {
    delete servers[id];
    saveMcpServersSync(servers, storePath);
    return true;
  }
  return false;
}

/**
 * Installs an MCP server directly from the curated catalog.
 */
export function installFromCatalog(
  catalogId: string,
  storePath?: string,
  overrides?: Partial<McpServerConfig>,
): McpServerConfig {
  const item = COREBLOW_MCP_CATALOG.find((c) => c.id === catalogId);
  if (!item) {
    throw new Error(`MCP catalog item '${catalogId}' not found.`);
  }

  const serverConfig: McpServerConfig = {
    id: item.id,
    name: overrides?.name || item.name,
    transport: overrides?.transport || item.transport,
    command: overrides?.command !== undefined ? overrides.command : item.command,
    args: overrides?.args !== undefined ? overrides.args : item.args,
    url: overrides?.url !== undefined ? overrides.url : item.url,
    env: { ...item.env, ...overrides?.env },
    enabled: overrides?.enabled !== undefined ? overrides.enabled : true,
    status: "disconnected",
    description: overrides?.description || item.description,
  };

  return upsertMcpServer(serverConfig, storePath);
}

/**
 * Probes the reachability or command existence of an MCP server.
 */
export async function probeMcpServer(server: McpServerConfig): Promise<{
  ok: boolean;
  status: McpServerStatus;
  latencyMs?: number;
  error?: string;
}> {
  const start = Date.now();

  if (server.transport === "stdio") {
    const cmd = server.command?.trim();
    if (!cmd) {
      return { ok: false, status: "error", error: "Missing command for stdio transport" };
    }

    // Check if command is absolute path
    if (path.isAbsolute(cmd)) {
      if (fs.existsSync(cmd)) {
        return { ok: true, status: "connected", latencyMs: Date.now() - start };
      }
      return { ok: false, status: "error", error: `Binary not found at '${cmd}'` };
    }

    // Search PATH for binary
    const pathDirs = (process.env.PATH || "").split(path.delimiter);
    let found = false;
    const extensions = process.platform === "win32"
      ? (process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";").map((e) => e.toLowerCase())
      : [""];
    for (const dir of pathDirs) {
      for (const ext of extensions) {
        const full = path.join(dir, ext ? `${cmd}${ext}` : cmd);
        try {
          if (fs.existsSync(full) && fs.statSync(full).isFile()) {
            found = true;
            break;
          }
        } catch {}
      }
      if (found) break;
    }

    if (found) {
      return { ok: true, status: "connected", latencyMs: Date.now() - start };
    }

    return {
      ok: false,
      status: "error",
      error: `Command '${cmd}' not found in PATH`,
    };
  }

  // SSE or HTTP transport probe
  if (!server.url) {
    return { ok: false, status: "error", error: "Missing URL for SSE/HTTP transport" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(server.url, {
      method: "HEAD",
      signal: controller.signal,
    }).catch(() =>
      // Retry with GET if HEAD fails
      fetch(server.url!, { method: "GET", signal: controller.signal })
    );

    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    // Any HTTP status indicates network reachability
    if (res && res.status < 500) {
      return { ok: true, status: "connected", latencyMs };
    }

    return {
      ok: false,
      status: "error",
      latencyMs,
      error: `Server responded with HTTP ${res?.status || "unknown"}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: "disconnected",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
