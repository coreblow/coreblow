import { LitElement, html, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { CoreBlowApp } from "../app.ts";
import { renderIcon, type IconName } from "../icons.ts";

export interface McpTool {
  id: string;
  label: string;
  description: string;
  serverName: string;
}

export interface McpServerEntry {
  name: string;
  transport: "stdio" | "streamable-http" | "sse";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  enabled: boolean;
  status: "connected" | "configured" | "disabled" | "offline";
  tools: McpTool[];
}

export const OFFLINE_MCP_SERVERS: McpServerEntry[] = [
  {
    name: "coreblow-filesystem",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
    enabled: true,
    status: "configured",
    tools: [
      {
        id: "coreblow-filesystem__read_file",
        label: "read_file",
        description: "Read complete contents of a file from the workspace filesystem.",
        serverName: "coreblow-filesystem",
      },
      {
        id: "coreblow-filesystem__write_file",
        label: "write_file",
        description: "Create or atomically overwrite a file on the local filesystem.",
        serverName: "coreblow-filesystem",
      },
      {
        id: "coreblow-filesystem__list_directory",
        label: "list_directory",
        description: "List directory contents with file metadata and attributes.",
        serverName: "coreblow-filesystem",
      },
    ],
  },
  {
    name: "coreblow-memory",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    enabled: true,
    status: "configured",
    tools: [
      {
        id: "coreblow-memory__create_entities",
        label: "create_entities",
        description: "Create new semantic entities in the long-term knowledge graph.",
        serverName: "coreblow-memory",
      },
      {
        id: "coreblow-memory__search_nodes",
        label: "search_nodes",
        description: "Search nodes and relationships across persistent session memory.",
        serverName: "coreblow-memory",
      },
    ],
  },
  {
    name: "coreblow-fetch",
    transport: "streamable-http",
    url: "http://127.0.0.1:8765/mcp",
    enabled: false,
    status: "disabled",
    tools: [
      {
        id: "coreblow-fetch__fetch_url",
        label: "fetch_url",
        description: "Fetch web pages and convert HTML to clean markdown text.",
        serverName: "coreblow-fetch",
      },
    ],
  },
];

@customElement("coreblow-mcp-view")
export class McpView extends LitElement {
  @property({ attribute: false }) app!: CoreBlowApp;

  @state() servers: McpServerEntry[] = [...OFFLINE_MCP_SERVERS];
  @state() loading = false;
  @state() searchQuery = "";
  @state() expandedServerName: string | null = null;
  @state() showAddServerModal = false;
  @state() baseHash: string | null = null;
  @state() statusMessage: { text: string; success: boolean } | null = null;

  // New server form state
  @state() newServerName = "";
  @state() newServerTransport: "stdio" | "streamable-http" | "sse" = "stdio";
  @state() newServerCommand = "";
  @state() newServerArgs = "";
  @state() newServerUrl = "";

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    void this.loadMcpRegistry();
  }

  protected updated(changedProperties: PropertyValues): void {
    if (changedProperties.has("app")) {
      const prevApp = changedProperties.get("app") as CoreBlowApp | undefined;
      if (prevApp?.connected !== this.app?.connected) {
        void this.loadMcpRegistry();
      }
    }
  }

  async loadMcpRegistry() {
    const client = this.app?.gateway?.getClient();
    if (!client?.connected) {
      this.servers = [...OFFLINE_MCP_SERVERS];
      return;
    }

    this.loading = true;
    try {
      // 1. Fetch config for mcp.servers
      let configuredServers: Record<string, any> = {};
      try {
        const configResult = await client.request<{
          config?: { mcp?: { servers?: Record<string, any> } };
          baseHash?: string;
          hash?: string;
        }>("config.get", {});

        this.baseHash = configResult?.baseHash ?? configResult?.hash ?? null;
        if (configResult?.config?.mcp?.servers) {
          configuredServers = configResult.config.mcp.servers;
        }
      } catch (err) {
        console.warn("Failed to load mcp server config:", err);
      }

      // 2. Fetch tools catalog to map exposed MCP tools
      const toolMapByServer = new Map<string, McpTool[]>();
      try {
        const toolsRes = await client.request<{
          groups?: Array<{
            id: string;
            label: string;
            source: string;
            pluginId?: string;
            tools: Array<{ id: string; label: string; description: string; source: string; pluginId?: string }>;
          }>;
        }>("tools.catalog", {});

        if (toolsRes?.groups) {
          for (const group of toolsRes.groups) {
            const serverName = group.pluginId || (group.id.startsWith("plugin:") ? group.id.replace("plugin:", "") : group.id);
            const tools: McpTool[] = group.tools.map((t) => ({
              id: t.id,
              label: t.label || t.id,
              description: t.description || "",
              serverName,
            }));
            const existing = toolMapByServer.get(serverName) || [];
            toolMapByServer.set(serverName, [...existing, ...tools]);
          }
        }
      } catch (err) {
        console.warn("Failed to load tools catalog from gateway:", err);
      }

      // 3. Assemble server list
      const serverNames = Object.keys(configuredServers);
      if (serverNames.length === 0) {
        // Fallback to offline defaults if none configured yet
        this.servers = [...OFFLINE_MCP_SERVERS];
      } else {
        this.servers = serverNames.map((name) => {
          const cfg = configuredServers[name] || {};
          const isEnabled = cfg.enabled !== false;
          const transport = cfg.transport || (cfg.url ? "streamable-http" : "stdio");
          const exposedTools = toolMapByServer.get(name) || [];

          return {
            name,
            transport,
            command: cfg.command,
            args: Array.isArray(cfg.args) ? cfg.args : undefined,
            url: cfg.url,
            env: cfg.env,
            enabled: isEnabled,
            status: !isEnabled ? "disabled" : exposedTools.length > 0 ? "connected" : "configured",
            tools: exposedTools,
          };
        });
      }
    } finally {
      this.loading = false;
    }
  }

  async toggleServerEnabled(server: McpServerEntry) {
    server.enabled = !server.enabled;
    server.status = server.enabled ? "configured" : "disabled";
    this.requestUpdate();

    const client = this.app?.gateway?.getClient();
    if (!client?.connected) return;

    try {
      await client.request("config.patch", {
        raw: JSON.stringify({
          mcp: {
            servers: {
              [server.name]: { enabled: server.enabled },
            },
          },
        }),
        baseHash: this.baseHash,
      });
    } catch (err) {
      console.warn("Failed to toggle MCP server enabled:", err);
    }
  }

  async deleteServer(serverName: string) {
    this.servers = this.servers.filter((s) => s.name !== serverName);
    this.requestUpdate();

    const client = this.app?.gateway?.getClient();
    if (!client?.connected) {
      this.statusMessage = { text: `Removed server "${serverName}" locally (offline).`, success: true };
      return;
    }

    try {
      // CoreBlow config supports removing keys with null or empty patch
      await client.request("config.patch", {
        raw: JSON.stringify({
          mcp: {
            servers: {
              [serverName]: null,
            },
          },
        }),
        baseHash: this.baseHash,
      });
      this.statusMessage = { text: `Removed MCP server "${serverName}".`, success: true };
    } catch (err) {
      this.statusMessage = { text: `Failed to remove server: ${String(err)}`, success: false };
    }
  }

  async addServer() {
    const name = this.newServerName.trim();
    if (!name) return;

    const newEntry: McpServerEntry = {
      name,
      transport: this.newServerTransport,
      command: this.newServerTransport === "stdio" ? this.newServerCommand.trim() || undefined : undefined,
      args:
        this.newServerTransport === "stdio" && this.newServerArgs.trim()
          ? this.newServerArgs.split(" ").filter(Boolean)
          : undefined,
      url: this.newServerTransport !== "stdio" ? this.newServerUrl.trim() || undefined : undefined,
      enabled: true,
      status: "configured",
      tools: [],
    };

    this.servers = [...this.servers, newEntry];
    this.showAddServerModal = false;
    this.resetAddForm();
    this.requestUpdate();

    const client = this.app?.gateway?.getClient();
    if (!client?.connected) {
      this.statusMessage = { text: `Added MCP server "${name}" locally (offline).`, success: true };
      return;
    }

    try {
      const serverConfig: Record<string, any> = {
        transport: newEntry.transport,
        enabled: true,
      };
      if (newEntry.command) serverConfig.command = newEntry.command;
      if (newEntry.args) serverConfig.args = newEntry.args;
      if (newEntry.url) serverConfig.url = newEntry.url;

      await client.request("config.patch", {
        raw: JSON.stringify({
          mcp: {
            servers: {
              [name]: serverConfig,
            },
          },
        }),
        baseHash: this.baseHash,
      });
      this.statusMessage = { text: `Successfully registered MCP server "${name}".`, success: true };
    } catch (err) {
      this.statusMessage = { text: `Failed to register server: ${String(err)}`, success: false };
    }
  }

  private resetAddForm() {
    this.newServerName = "";
    this.newServerTransport = "stdio";
    this.newServerCommand = "";
    this.newServerArgs = "";
    this.newServerUrl = "";
  }

  render() {
    const isOnline = Boolean(this.app?.connected);
    const query = this.searchQuery.trim().toLowerCase();

    const filteredServers = this.servers.filter((s) => {
      if (!query) return true;
      const matchesServer = s.name.toLowerCase().includes(query) || s.transport.toLowerCase().includes(query);
      const matchesTool = s.tools.some(
        (t) => t.label.toLowerCase().includes(query) || t.id.toLowerCase().includes(query) || t.description.toLowerCase().includes(query),
      );
      return matchesServer || matchesTool;
    });

    const totalConfigured = this.servers.length;
    const totalEnabled = this.servers.filter((s) => s.enabled).length;
    const totalTools = this.servers.reduce((sum, s) => sum + s.tools.length, 0);

    return html`
      <div style="max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px;">
        <!-- Header -->
        <div style="display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
          <div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <h1 style="font-size: 20px; font-weight: 700; margin: 0; color: var(--text-strong); letter-spacing: -0.01em;">
                Model Context Protocol (MCP) Registry
              </h1>
              <span
                style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: var(--radius-full); border: 1px solid ${isOnline ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}; background: ${isOnline ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)"}; color: ${isOnline ? "var(--ok, #22c55e)" : "var(--danger, #f87171)"};"
              >
                <span style="width: 6px; height: 6px; border-radius: 50%; background: ${isOnline ? "var(--ok, #22c55e)" : "var(--danger, #f87171)"};"></span>
                ${isOnline ? "Gateway Live" : "Offline Defaults"}
              </span>
            </div>
            <p style="margin: 4px 0 0; font-size: 13px; color: var(--muted); line-height: 1.4;">
              Manage external tool providers and stdio/http transports with collision-safe namespacing (<code style="font-family: var(--mono); color: var(--accent);">&dollar;{pluginId}__&dollar;{toolName}</code>).
            </p>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <!-- Register Server Button -->
            <button
              type="button"
              style="display: flex; align-items: center; gap: 6px; background: var(--accent); border: 1px solid var(--accent); padding: 6px 14px; border-radius: var(--radius-sm); color: #fff; font-size: 12px; font-weight: 600; cursor: pointer;"
              @click=${() => (this.showAddServerModal = true)}
            >
              <span style="font-size: 14px; line-height: 1;">+</span>
              Register Server
            </button>

            <!-- Refresh Button -->
            <button
              type="button"
              style="display: flex; align-items: center; gap: 6px; background: var(--card); border: 1px solid var(--border-hairline); padding: 6px 12px; border-radius: var(--radius-sm); color: var(--text-strong); font-size: 11px; font-weight: 500; cursor: pointer;"
              title="Reload MCP registry from gateway"
              @click=${() => void this.loadMcpRegistry()}
            >
              <span style="width: 13px; height: 13px;">${renderIcon("refresh")}</span>
              ${this.loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        <!-- Toast Status Banner -->
        ${this.statusMessage
          ? html`
              <div
                style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: var(--radius-sm); font-size: 12px; border: 1px solid ${this.statusMessage.success ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}; background: ${this.statusMessage.success ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)"}; color: ${this.statusMessage.success ? "var(--ok, #22c55e)" : "var(--danger, #f87171)"};"
              >
                <span>${this.statusMessage.text}</span>
                <button
                  type="button"
                  style="background: transparent; border: none; color: inherit; cursor: pointer; font-size: 14px;"
                  @click=${() => (this.statusMessage = null)}
                >
                  ×
                </button>
              </div>
            `
          : ""}

        <!-- Summary Strip & CLI Reference -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px;">
          <!-- Configured Servers -->
          <div
            style="background: var(--card); border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); padding: 14px 16px; display: flex; flex-direction: column; gap: 4px;"
          >
            <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--muted); letter-spacing: 0.04em;">
              Configured Servers
            </span>
            <div style="font-size: 22px; font-weight: 700; color: var(--text-strong);">
              ${totalConfigured} <span style="font-size: 13px; font-weight: 500; color: var(--muted);">(${totalEnabled} active)</span>
            </div>
            <div style="font-size: 11px; color: var(--muted);">
              External stdio / HTTP daemon processes attached to the agent loop.
            </div>
          </div>

          <!-- Exposed Tools -->
          <div
            style="background: var(--card); border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); padding: 14px 16px; display: flex; flex-direction: column; gap: 4px;"
          >
            <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--muted); letter-spacing: 0.04em;">
              Exposed Tools
            </span>
            <div style="font-size: 22px; font-weight: 700; color: var(--accent);">
              ${totalTools}
            </div>
            <div style="font-size: 11px; color: var(--muted);">
              Namespace-isolated functions available for LLM tool invocation.
            </div>
          </div>

          <!-- Local CLI Serve Quickref -->
          <div
            style="background: var(--card); border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); padding: 14px 16px; display: flex; flex-direction: column; gap: 6px;"
          >
            <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--muted); letter-spacing: 0.04em;">
              CoreBlow MCP CLI Quickref
            </span>
            <div style="background: var(--surface-flat-muted); border: 1px solid var(--border-subtle); padding: 6px 10px; border-radius: var(--radius-sm); font-family: var(--mono); font-size: 11px; color: var(--text-strong);">
              coreblow mcp serve
            </div>
            <div style="font-size: 11px; color: var(--muted);">
              Run CoreBlow as an MCP server to expose local channels, agents, and sessions.
            </div>
          </div>
        </div>

        <!-- Add Server Modal / Form -->
        ${this.showAddServerModal
          ? html`
              <div
                style="background: var(--card); border: 1px solid color-mix(in srgb, var(--accent) 50%, var(--border-hairline)); border-radius: var(--radius-sm); padding: 16px; display: flex; flex-direction: column; gap: 14px;"
              >
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: var(--text-strong);">
                    Register New MCP Server
                  </h3>
                  <button
                    type="button"
                    style="background: transparent; border: none; color: var(--muted); cursor: pointer; font-size: 14px;"
                    @click=${() => (this.showAddServerModal = false)}
                  >
                    ✕
                  </button>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
                  <div>
                    <label style="display: block; font-size: 11px; font-weight: 600; color: var(--muted); margin-bottom: 4px;">
                      Server Identifier
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. github, filesystem, sqlite"
                      style="width: 100%; background: var(--bg); border: 1px solid var(--border-hairline); color: var(--text-strong); font-size: 12px; padding: 6px 10px; border-radius: var(--radius-sm); outline: none;"
                      .value=${this.newServerName}
                      @input=${(e: Event) => (this.newServerName = (e.target as HTMLInputElement).value)}
                    />
                  </div>

                  <div>
                    <label style="display: block; font-size: 11px; font-weight: 600; color: var(--muted); margin-bottom: 4px;">
                      Transport Type
                    </label>
                    <select
                      style="width: 100%; background: var(--bg); border: 1px solid var(--border-hairline); color: var(--text-strong); font-size: 12px; padding: 6px 10px; border-radius: var(--radius-sm); outline: none;"
                      .value=${this.newServerTransport}
                      @change=${(e: Event) => (this.newServerTransport = (e.target as HTMLSelectElement).value as any)}
                    >
                      <option value="stdio">stdio (Local Process)</option>
                      <option value="streamable-http">streamable-http (HTTP Daemon)</option>
                      <option value="sse">sse (Server-Sent Events)</option>
                    </select>
                  </div>
                </div>

                ${this.newServerTransport === "stdio"
                  ? html`
                      <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 12px;">
                        <div>
                          <label style="display: block; font-size: 11px; font-weight: 600; color: var(--muted); margin-bottom: 4px;">
                            Command
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. npx, uvx, node"
                            style="width: 100%; background: var(--bg); border: 1px solid var(--border-hairline); color: var(--text-strong); font-family: var(--mono); font-size: 12px; padding: 6px 10px; border-radius: var(--radius-sm); outline: none;"
                            .value=${this.newServerCommand}
                            @input=${(e: Event) => (this.newServerCommand = (e.target as HTMLInputElement).value)}
                          />
                        </div>
                        <div>
                          <label style="display: block; font-size: 11px; font-weight: 600; color: var(--muted); margin-bottom: 4px;">
                            Arguments (space-separated)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. -y @modelcontextprotocol/server-sqlite --db /data.db"
                            style="width: 100%; background: var(--bg); border: 1px solid var(--border-hairline); color: var(--text-strong); font-family: var(--mono); font-size: 12px; padding: 6px 10px; border-radius: var(--radius-sm); outline: none;"
                            .value=${this.newServerArgs}
                            @input=${(e: Event) => (this.newServerArgs = (e.target as HTMLInputElement).value)}
                          />
                        </div>
                      </div>
                    `
                  : html`
                      <div>
                        <label style="display: block; font-size: 11px; font-weight: 600; color: var(--muted); margin-bottom: 4px;">
                          Endpoint URL
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. http://127.0.0.1:8000/sse"
                          style="width: 100%; background: var(--bg); border: 1px solid var(--border-hairline); color: var(--text-strong); font-family: var(--mono); font-size: 12px; padding: 6px 10px; border-radius: var(--radius-sm); outline: none;"
                          .value=${this.newServerUrl}
                          @input=${(e: Event) => (this.newServerUrl = (e.target as HTMLInputElement).value)}
                        />
                      </div>
                    `}

                <div style="display: flex; justify-content: flex-end; gap: 8px;">
                  <button
                    type="button"
                    style="background: transparent; border: 1px solid var(--border-hairline); padding: 6px 14px; border-radius: var(--radius-sm); font-size: 12px; color: var(--muted); cursor: pointer;"
                    @click=${() => (this.showAddServerModal = false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    style="background: var(--accent); border: 1px solid var(--accent); padding: 6px 16px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 600; color: #fff; cursor: pointer;"
                    ?disabled=${!this.newServerName.trim()}
                    @click=${() => this.addServer()}
                  >
                    Save &amp; Connect
                  </button>
                </div>
              </div>
            `
          : ""}

        <!-- Search Bar -->
        <div style="position: relative; max-width: 360px;">
          <input
            type="text"
            placeholder="Filter servers and exposed tools..."
            style="width: 100%; background: var(--card); border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); padding: 6px 10px 6px 30px; font-size: 12px; color: var(--text-strong); outline: none;"
            .value=${this.searchQuery}
            @input=${(e: Event) => (this.searchQuery = (e.target as HTMLInputElement).value)}
          />
          <span
            style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); width: 13px; height: 13px; color: var(--muted); pointer-events: none;"
          >
            ${renderIcon("search")}
          </span>
        </div>

        <!-- Servers Flat Hairline List -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${filteredServers.length === 0
            ? html`
                <div style="background: var(--card); border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); padding: 32px; text-align: center; color: var(--muted); font-size: 13px;">
                  No MCP servers match the current filter query "${this.searchQuery}".
                </div>
              `
            : filteredServers.map((server) => {
                const isExpanded = this.expandedServerName === server.name;

                return html`
                  <div
                    style="background: var(--card); border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); overflow: hidden; transition: border-color 0.15s ease;"
                  >
                    <!-- Server Header Strip -->
                    <div
                      style="padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;"
                    >
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="color: var(--accent); width: 16px; height: 16px;">
                          ${renderIcon("puzzle")}
                        </span>
                        <div>
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-weight: 700; font-size: 13px; color: var(--text-strong); font-family: var(--mono);">
                              ${server.name}
                            </span>
                            <span
                              style="font-size: 10px; font-weight: 600; text-transform: uppercase; padding: 1px 6px; border-radius: 4px; border: 1px solid var(--border-hairline); background: var(--surface-flat-muted); color: var(--muted);"
                            >
                              ${server.transport}
                            </span>
                            <span
                              style="display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px; background: ${server.enabled ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)"}; color: ${server.enabled ? "var(--ok, #22c55e)" : "var(--danger, #f87171)"};"
                            >
                              <span style="width: 5px; height: 5px; border-radius: 50%; background: ${server.enabled ? "var(--ok, #22c55e)" : "var(--danger, #f87171)"};"></span>
                              ${server.enabled ? "Active" : "Disabled"}
                            </span>
                          </div>

                          <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">
                            ${server.command
                              ? html`<code style="font-family: var(--mono);">${server.command} ${(server.args || []).join(" ")}</code>`
                              : server.url
                                ? html`<code style="font-family: var(--mono);">${server.url}</code>`
                                : "No execution command defined"}
                          </div>
                        </div>
                      </div>

                      <div style="display: flex; align-items: center; gap: 10px;">
                        <!-- Exposed Tools Badge / Expand Trigger -->
                        <button
                          type="button"
                          style="background: var(--surface-flat-muted); border: 1px solid var(--border-hairline); padding: 4px 10px; border-radius: var(--radius-sm); font-size: 11px; font-weight: 600; color: var(--text); cursor: pointer;"
                          @click=${() => (this.expandedServerName = isExpanded ? null : server.name)}
                        >
                          ${server.tools.length} Tools ${isExpanded ? "▲" : "▼"}
                        </button>

                        <!-- Enable/Disable Switch -->
                        <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 11px; color: var(--muted);">
                          <input
                            type="checkbox"
                            style="accent-color: var(--accent);"
                            .checked=${server.enabled}
                            @change=${() => this.toggleServerEnabled(server)}
                          />
                          Enabled
                        </label>

                        <!-- Delete Server Button -->
                        <button
                          type="button"
                          style="background: transparent; border: none; color: var(--muted); cursor: pointer; padding: 4px; border-radius: 4px;"
                          title="Remove MCP server"
                          @click=${() => this.deleteServer(server.name)}
                        >
                          <span style="width: 14px; height: 14px; display: block;">${renderIcon("trash")}</span>
                        </button>
                      </div>
                    </div>

                    <!-- Expandable Exposed Tools Drawer -->
                    ${isExpanded
                      ? html`
                          <div style="border-top: 1px solid var(--border-subtle); background: var(--bg); padding: 12px 16px;">
                            <div style="font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; margin-bottom: 8px;">
                              Exposed Tools (${server.tools.length})
                            </div>
                            ${server.tools.length === 0
                              ? html`
                                  <div style="font-size: 12px; color: var(--muted); font-style: italic;">
                                    No tools exposed by this server yet or server is initializing.
                                  </div>
                                `
                              : html`
                                  <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 8px;">
                                    ${server.tools.map(
                                      (t) => html`
                                        <div
                                          style="border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); padding: 8px 10px; background: var(--card);"
                                        >
                                          <div style="font-family: var(--mono); font-size: 11px; font-weight: 600; color: var(--accent);">
                                            ${t.id}
                                          </div>
                                          <div style="font-size: 11px; color: var(--muted); margin-top: 2px; line-height: 1.3;">
                                            ${t.description || "No description provided."}
                                          </div>
                                        </div>
                                      `,
                                    )}
                                  </div>
                                `}
                          </div>
                        `
                      : ""}
                  </div>
                `;
              })}
        </div>
      </div>
    `;
  }
}
