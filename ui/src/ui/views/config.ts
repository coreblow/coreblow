import { LitElement, html, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { t } from "../../i18n/index.ts";
import type { CoreBlowApp } from "../app.ts";
import { renderIcon } from "../icons.ts";
import {
  type JsonSchemaNode,
  type SchemaSection,
  extractSchemaSections,
  OFFLINE_SCHEMA_CATALOG,
  renderSchemaField,
  getByPath,
  setByPath,
  isSecretField,
  searchSchemaFields,
  type FlatFieldMatch,
} from "./config-schema-renderer.ts";

@customElement("coreblow-config-view")
export class ConfigView extends LitElement {
  @property({ attribute: false }) app!: CoreBlowApp;

  @state() schema: JsonSchemaNode = OFFLINE_SCHEMA_CATALOG;
  @state() sections: SchemaSection[] = [];
  @state() activeSectionId = "gateway";
  @state() rawConfig: Record<string, unknown> = {};
  @state() dirtyChanges: Map<string, unknown> = new Map();
  @state() searchQuery = "";
  @state() viewMode: "visual" | "json" = "visual";
  @state() rawJsonText = "{}";
  @state() rawJsonError: string | null = null;

  @state() collapsedPaths: Set<string> = new Set();
  @state() revealedSecrets: Set<string> = new Set();

  @state() loading = false;
  @state() saving = false;
  @state() saveStatus: { success: boolean; message: string } | null = null;
  @state() configPath = "~/.coreblow/config.json";
  @state() snapshotHash: string | undefined = undefined;

  // Gateway Connection Form
  @state() editGatewayUrl = "";
  @state() editGatewayToken = "";
  @state() isGatewaySecretRevealed = false;

  private wasConnected = false;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.editGatewayUrl = this.app?.settings?.gatewayUrl ?? "ws://127.0.0.1:18789";
    this.editGatewayToken = this.app?.settings?.token ?? "";
    this.sections = extractSchemaSections(this.schema);
    this.rawConfig = this.buildInitialDefaults();
    this.rawJsonText = JSON.stringify(this.rawConfig, null, 2);
    void this.loadConfig();
  }

  override updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    const isConn = Boolean(this.app?.connected);
    if (isConn !== this.wasConnected) {
      this.wasConnected = isConn;
      if (isConn) {
        void this.loadConfig();
      }
    }
  }

  private buildInitialDefaults(): Record<string, unknown> {
    const defaults: Record<string, unknown> = {
      gateway: {
        port: 18789,
        mode: "local",
        bind: "loopback",
        customBindHost: "127.0.0.1",
        controlUi: true,
        auth: { token: "", required: false },
        tailscale: false,
      },
      agents: {
        defaults: {
          model: "gemini-2.5-pro",
          workspace: "~/.coreblow/workspace",
          thinkingDefault: "auto",
          contextTokens: 1000000,
          timeoutSeconds: 600,
          maxConcurrent: 16,
        },
      },
      models: {
        default: "gemini-2.5-pro",
        providers: ["google", "openai", "anthropic", "ollama", "openrouter"],
        mode: "direct",
      },
      memory: {
        backend: "builtin",
        citations: "auto",
        qmd: {
          command: "qmd",
          searchMode: "query",
          mcporterEnabled: false,
        },
      },
      tools: {
        autoApprove: ["read_file", "list_dir", "grep_search", "memory_search"],
        requireApproval: ["run_command", "write_file", "git_push", "screen_capture"],
        deny: [],
      },
      channels: {
        telegram: { enabled: false, dmScope: "per-channel-peer" },
        discord: { enabled: false },
        slack: { enabled: false },
        signal: { enabled: false },
        web: { enabled: false, port: 3000 },
      },
      browser: {
        enabled: true,
        headless: true,
        color: "forest-teal",
        attachOnly: false,
      },
      logging: {
        level: "info",
        file: "~/.coreblow/logs/gateway.log",
        consoleLevel: "info",
        consoleStyle: "pretty",
        redactSensitive: true,
      },
      ui: {
        theme: "obsidian",
        accentColor: "forest-teal",
        assistantName: "CoreBlow",
      },
    };
    return defaults;
  }

  private async loadConfig() {
    const client = this.app?.gateway?.getClient();
    if (!client?.connected) {
      // Offline fallback
      if (this.sections.length === 0) {
        this.sections = extractSchemaSections(OFFLINE_SCHEMA_CATALOG);
      }
      return;
    }

    this.loading = true;
    try {
      // 1. Fetch live Draft-07 JSON Schema
      try {
        const schemaRes = await client.request<{
          schema?: JsonSchemaNode;
          version?: string;
        }>("config.schema", {});
        if (
          schemaRes?.schema &&
          schemaRes.schema.properties &&
          Object.keys(schemaRes.schema.properties).length > 0
        ) {
          this.schema = schemaRes.schema;
          this.sections = extractSchemaSections(this.schema);
        }
      } catch (err) {
        console.warn("Failed to fetch live schema from gateway:", err);
      }

      // 2. Fetch live config snapshot
      const getRes = await client.request<{
        path?: string;
        hash?: string;
        config?: Record<string, unknown>;
        raw?: string | null;
      }>("config.get", {});

      if (getRes) {
        if (getRes.path) this.configPath = getRes.path;
        if (getRes.hash) this.snapshotHash = getRes.hash;
        if (getRes.config && typeof getRes.config === "object") {
          this.rawConfig = getRes.config;
          this.rawJsonText = JSON.stringify(this.rawConfig, null, 2);
          this.dirtyChanges.clear();
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.saveStatus = { success: false, message: `Load failed: ${msg}` };
    } finally {
      this.loading = false;
    }
  }

  private handleFieldChange = (path: string, newValue: unknown) => {
    const baseline = getByPath(this.rawConfig, path);
    if (newValue === baseline) {
      this.dirtyChanges.delete(path);
    } else {
      this.dirtyChanges.set(path, newValue);
    }

    // Keep JSON editor in sync with changes
    let merged = { ...this.rawConfig };
    for (const [p, val] of this.dirtyChanges.entries()) {
      merged = setByPath(merged, p, val);
    }
    this.rawJsonText = JSON.stringify(merged, null, 2);
    this.rawJsonError = null;
    this.requestUpdate();
  };

  private toggleCollapse = (path: string) => {
    if (this.collapsedPaths.has(path)) {
      this.collapsedPaths.delete(path);
    } else {
      this.collapsedPaths.add(path);
    }
    this.requestUpdate();
  };

  private toggleReveal = (path: string) => {
    if (this.revealedSecrets.has(path)) {
      this.revealedSecrets.delete(path);
    } else {
      this.revealedSecrets.add(path);
    }
    this.requestUpdate();
  };

  private saveGatewayConnection() {
    if (!this.app) return;
    this.app.applySettings({
      ...this.app.settings,
      gatewayUrl: this.editGatewayUrl.trim(),
      token: this.editGatewayToken.trim(),
    });
    this.app.gateway?.reconnect();
    this.saveStatus = {
      success: true,
      message: "Gateway connection settings updated. Reconnecting...",
    };
    setTimeout(() => {
      if (this.saveStatus?.message.includes("Reconnecting")) {
        this.saveStatus = null;
      }
    }, 4000);
  }

  private async saveChanges() {
    const client = this.app?.gateway?.getClient();
    if (!client?.connected) {
      this.saveStatus = {
        success: false,
        message: "Cannot save: Gateway is offline. Verify connection settings.",
      };
      return;
    }

    this.saving = true;
    this.saveStatus = null;

    try {
      if (this.viewMode === "json") {
        let parsed: unknown;
        try {
          parsed = JSON.parse(this.rawJsonText);
        } catch (err) {
          this.rawJsonError = `JSON Syntax Error: ${err instanceof Error ? err.message : String(err)}`;
          this.saving = false;
          return;
        }

        await client.request("config.apply", {
          raw: JSON.stringify(parsed, null, 2),
          baseHash: this.snapshotHash,
          note: "Web Control UI JSON editor update",
        });

        this.saveStatus = {
          success: true,
          message: "Configuration saved and applied via Gateway RPC.",
        };
      } else {
        if (this.dirtyChanges.size === 0) {
          this.saveStatus = { success: true, message: "No changes to save." };
          this.saving = false;
          return;
        }

        let patchObj: Record<string, unknown> = {};
        for (const [path, val] of this.dirtyChanges.entries()) {
          patchObj = setByPath(patchObj, path, val);
        }

        await client.request("config.patch", {
          raw: JSON.stringify(patchObj),
          baseHash: this.snapshotHash,
          note: `Web Control UI update (${this.dirtyChanges.size} fields)`,
        });

        this.saveStatus = {
          success: true,
          message: `Successfully saved ${this.dirtyChanges.size} modified field(s).`,
        };
        this.dirtyChanges.clear();
      }

      await this.loadConfig();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.saveStatus = { success: false, message: `Save error: ${msg}` };
    } finally {
      this.saving = false;
    }
  }

  private exportJson() {
    let effective = { ...this.rawConfig };
    for (const [p, val] of this.dirtyChanges.entries()) {
      effective = setByPath(effective, p, val);
    }
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(effective, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "coreblow-config.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  private isSectionDirty(sectionId: string): boolean {
    for (const path of this.dirtyChanges.keys()) {
      if (path === sectionId || path.startsWith(`${sectionId}.`)) {
        return true;
      }
    }
    return false;
  }

  render() {
    const isConnected = Boolean(this.app?.connected);
    const activeSection = this.sections.find((s) => s.id === this.activeSectionId);
    const searchMatches = this.searchQuery
      ? searchSchemaFields(this.schema, this.searchQuery)
      : [];

    return html`
      <div
        class="config-view-root"
        style="padding: 24px 32px; max-width: 1200px; margin: 0 auto; color: var(--text);"
      >
        <!-- Header Bar -->
        <div
          class="config-header"
          style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap;"
        >
          <div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 20px; font-weight: 700; color: var(--text-strong); letter-spacing: -0.02em;">
                ${t("config.title")}
              </span>
              <span
                style="display: inline-flex; align-items: center; gap: 6px; font-size: 11px; padding: 3px 9px; border-radius: 12px; background: ${isConnected
                  ? "var(--surface-flat-hover)"
                  : "var(--bg-muted)"}; color: ${isConnected
                  ? "var(--accent)"
                  : "var(--muted)"}; border: 1px solid var(--border-hairline); font-family: var(--mono);"
              >
                <span
                  style="width: 6px; height: 6px; border-radius: 50%; background: ${isConnected
                    ? "var(--accent)"
                    : "var(--muted)"};"
                ></span>
                ${isConnected ? this.configPath : "Offline Defaults"}
              </span>
              <span
                style="font-size: 11px; color: var(--muted); font-family: var(--mono);"
              >
                ${this.sections.length} sections
              </span>
            </div>
            <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">
              CoreBlow Schema-Driven Quiet Instrument · Full Draft-07 Parity
            </div>
          </div>

          <!-- Controls: Search + Mode + Actions -->
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <!-- Real-time Search Input -->
            <div style="position: relative; width: 230px;">
              <input
                type="text"
                placeholder="Search config fields..."
                style="width: 100%; background: var(--card); border: 1px solid var(--border-hairline); padding: 7px 10px 7px 30px; border-radius: var(--radius-sm); color: var(--text-strong); font-size: 12px; font-family: var(--mono); outline: none;"
                .value=${this.searchQuery}
                @input=${(e: Event) => (this.searchQuery = (e.target as HTMLInputElement).value)}
              />
              <span
                style="position: absolute; left: 9px; top: 8px; width: 14px; height: 14px; color: var(--muted); pointer-events: none;"
              >
                ${renderIcon("search")}
              </span>
              ${this.searchQuery
                ? html`
                    <button
                      type="button"
                      style="position: absolute; right: 8px; top: 8px; width: 14px; height: 14px; background: transparent; border: none; color: var(--muted); cursor: pointer; padding: 0;"
                      @click=${() => (this.searchQuery = "")}
                    >
                      ${renderIcon("x")}
                    </button>
                  `
                : ""}
            </div>

            <!-- Visual / JSON Mode Toggle -->
            <div
              style="display: flex; background: var(--card); border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); padding: 2px;"
            >
              <button
                type="button"
                style="padding: 5px 12px; font-size: 11px; font-weight: 600; border-radius: 3px; border: none; cursor: pointer; background: ${this.viewMode === "visual"
                  ? "var(--accent)"
                  : "transparent"}; color: ${this.viewMode === "visual"
                  ? "var(--primary-foreground)"
                  : "var(--muted)"}; transition: all 0.15s ease;"
                @click=${() => (this.viewMode = "visual")}
              >
                Visual
              </button>
              <button
                type="button"
                style="padding: 5px 12px; font-size: 11px; font-weight: 600; border-radius: 3px; border: none; cursor: pointer; background: ${this.viewMode === "json"
                  ? "var(--accent)"
                  : "transparent"}; color: ${this.viewMode === "json"
                  ? "var(--primary-foreground)"
                  : "var(--muted)"}; transition: all 0.15s ease;"
                @click=${() => (this.viewMode = "json")}
              >
                JSON
              </button>
            </div>

            <!-- Export JSON Button -->
            <button
              type="button"
              style="display: flex; align-items: center; gap: 6px; background: var(--card); border: 1px solid var(--border-hairline); padding: 6px 12px; border-radius: var(--radius-sm); color: var(--text-strong); font-size: 11px; font-weight: 500; cursor: pointer;"
              title="Export configuration as JSON"
              @click=${() => this.exportJson()}
            >
              <span style="width: 13px; height: 13px;">${renderIcon("download")}</span>
              Export
            </button>

            <!-- Refresh Button -->
            <button
              type="button"
              style="display: flex; align-items: center; gap: 6px; background: var(--card); border: 1px solid var(--border-hairline); padding: 6px 12px; border-radius: var(--radius-sm); color: var(--text-strong); font-size: 11px; font-weight: 500; cursor: pointer;"
              title="Reload configuration from gateway"
              @click=${() => void this.loadConfig()}
            >
              <span style="width: 13px; height: 13px;">${renderIcon("refresh")}</span>
              ${this.loading ? "Loading..." : "Refresh"}
            </button>

            <!-- Save Changes Button -->
            <button
              type="button"
              style="display: flex; align-items: center; gap: 6px; background: var(--accent); border: none; padding: 7px 16px; border-radius: var(--radius-sm); color: var(--primary-foreground); font-size: 12px; font-weight: 600; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.2);"
              ?disabled=${this.saving}
              @click=${() => void this.saveChanges()}
            >
              ${this.saving
                ? "Saving..."
                : this.dirtyChanges.size > 0
                  ? `Save (${this.dirtyChanges.size})`
                  : "Save Changes"}
            </button>
          </div>
        </div>

        <!-- Notification Banner -->
        ${this.saveStatus
          ? html`
              <div
                style="padding: 10px 14px; border-radius: var(--radius-sm); margin-bottom: 16px; font-size: 12px; display: flex; align-items: center; justify-content: space-between; background: ${this.saveStatus.success
                  ? "var(--surface-flat-hover)"
                  : "rgba(239, 68, 68, 0.1)"}; border: 1px solid ${this.saveStatus.success
                  ? "var(--accent)"
                  : "rgba(239, 68, 68, 0.3)"}; color: ${this.saveStatus.success
                  ? "var(--accent)"
                  : "var(--danger, #f87171)"};"
              >
                <span>${this.saveStatus.message}</span>
                <button
                  type="button"
                  style="background: transparent; border: none; color: inherit; cursor: pointer; font-size: 13px;"
                  @click=${() => (this.saveStatus = null)}
                >
                  ✕
                </button>
              </div>
            `
          : ""}

        <!-- Main Body: JSON Mode vs Visual Mode -->
        ${this.viewMode === "json"
          ? html`
              <div
                class="config-json-editor"
                style="background: var(--card); border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); padding: 16px;"
              >
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                  <span style="font-size: 12px; font-weight: 600; color: var(--text-strong);">
                    Raw JSON Config Editor
                  </span>
                  <span style="font-size: 11px; color: var(--muted); font-family: var(--mono);">
                    Direct Draft-07 representation
                  </span>
                </div>
                ${this.rawJsonError
                  ? html`
                      <div
                        style="padding: 8px 12px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: var(--danger, #f87171); border-radius: var(--radius-sm); font-size: 11px; font-family: var(--mono); margin-bottom: 10px;"
                      >
                        ${this.rawJsonError}
                      </div>
                    `
                  : ""}
                <textarea
                  style="width: 100%; height: 560px; background: var(--bg); border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); color: var(--text-strong); padding: 14px; font-size: 12px; font-family: var(--mono); line-height: 1.5; resize: vertical; outline: none;"
                  .value=${this.rawJsonText}
                  @input=${(e: Event) => {
                    this.rawJsonText = (e.target as HTMLTextAreaElement).value;
                    this.rawJsonError = null;
                  }}
                ></textarea>
              </div>
            `
          : html`
              <!-- Visual Mode: Section Navigation + Field List -->
              <div class="config-visual-grid">
                <!-- Left Section Navigation (Flat, Sticky, Scrollable) -->
                <aside class="config-section-nav">
                  <div class="config-nav-header">
                    <span class="config-nav-header__title">Sections</span>
                    <span class="config-nav-header__count">
                      ${this.sections.length} total
                    </span>
                  </div>

                  <div class="config-section-list" style="display: flex; flex-direction: column; gap: 2px;">
                    ${this.sections.map((sec) => {
                      const isActive = this.activeSectionId === sec.id;
                      const isDirty = this.isSectionDirty(sec.id);
                      return html`
                        <button
                          type="button"
                          class="config-section-btn ${isActive ? "active" : ""}"
                          @click=${() => {
                            this.activeSectionId = sec.id;
                            this.searchQuery = "";
                          }}
                        >
                          <div class="config-section-btn__left">
                            <span class="config-section-btn__icon">
                              ${renderIcon(sec.icon)}
                            </span>
                            <span class="config-section-btn__label">
                              ${sec.label}
                            </span>
                          </div>
                          <div class="config-section-btn__right">
                            ${isDirty
                              ? html`<span
                                  style="width: 6px; height: 6px; border-radius: 50%; background: var(--accent); flex-shrink: 0;"
                                  title="Has unsaved changes"
                                ></span>`
                              : ""}
                            <span class="config-section-btn__badge">
                              ${sec.fieldCount}
                            </span>
                          </div>
                        </button>
                      `;
                    })}
                  </div>
                </aside>

                <!-- Right Field List Panel -->
                <div
                  class="config-field-panel"
                  style="background: var(--card); border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); padding: 18px 20px; min-width: 0;"
                >
                  <!-- Search Results View -->
                  ${this.searchQuery
                    ? html`
                        <div>
                          <div style="margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 10px;">
                            <div>
                              <div style="font-size: 14px; font-weight: 600; color: var(--text-strong);">
                                Search Results for "${this.searchQuery}"
                              </div>
                              <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">
                                Found ${searchMatches.length} matching field(s) across all schema sections
                              </div>
                            </div>
                            <button
                              type="button"
                              style="background: transparent; border: 1px solid var(--border-hairline); padding: 4px 10px; border-radius: var(--radius-sm); font-size: 11px; color: var(--muted); cursor: pointer;"
                              @click=${() => (this.searchQuery = "")}
                            >
                              Clear Search
                            </button>
                          </div>
                          ${searchMatches.length === 0
                            ? html`<div style="padding: 24px 0; text-align: center; color: var(--muted); font-size: 13px;">
                                No configuration fields matched "${this.searchQuery}".
                              </div>`
                            : searchMatches.map((m: FlatFieldMatch) => {
                                const val = this.dirtyChanges.has(m.path)
                                  ? this.dirtyChanges.get(m.path)
                                  : getByPath(this.rawConfig, m.path);
                                const isMod = this.dirtyChanges.has(m.path);
                                const isSec = isSecretField(m.key, m.path);
                                const isRev = this.revealedSecrets.has(m.path);
                                return renderSchemaField({
                                  path: m.path,
                                  key: m.key,
                                  schema: m.schema,
                                  value: val,
                                  isModified: isMod,
                                  isSecret: isSec,
                                  isRevealed: isRev,
                                  depth: 0,
                                  collapsedPaths: this.collapsedPaths,
                                  onToggleCollapse: this.toggleCollapse,
                                  onToggleReveal: this.toggleReveal,
                                  onChange: this.handleFieldChange,
                                });
                              })}
                        </div>
                      `
                    : activeSection
                      ? html`
                          <div>
                            <!-- Section Header -->
                            <div
                              style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px; margin-bottom: 16px;"
                            >
                              <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="width: 20px; height: 20px; color: var(--accent);">
                                  ${renderIcon(activeSection.icon)}
                                </div>
                                <div>
                                  <div style="font-size: 16px; font-weight: 700; color: var(--text-strong);">
                                    ${activeSection.label}
                                  </div>
                                  ${activeSection.description
                                    ? html`<div style="font-size: 12px; color: var(--muted); margin-top: 2px;">
                                        ${activeSection.description}
                                      </div>`
                                    : ""}
                                </div>
                              </div>
                              <span
                                style="font-size: 11px; padding: 3px 8px; border-radius: 10px; background: var(--bg-muted); color: var(--muted); font-family: var(--mono);"
                              >
                                ${activeSection.fieldCount} leaf fields
                              </span>
                            </div>

                            <!-- Section Fields List -->
                            <div>
                              ${activeSection.schema.properties
                                ? Object.entries(activeSection.schema.properties).map(
                                    ([fieldKey, fieldSchema]) => {
                                      const fieldPath = `${activeSection.id}.${fieldKey}`;
                                      const fieldValue = this.dirtyChanges.has(fieldPath)
                                        ? this.dirtyChanges.get(fieldPath)
                                        : getByPath(this.rawConfig, fieldPath);
                                      const isMod = this.dirtyChanges.has(fieldPath);
                                      const isSec = isSecretField(fieldKey, fieldPath);
                                      const isRev = this.revealedSecrets.has(fieldPath);

                                      return renderSchemaField({
                                        path: fieldPath,
                                        key: fieldKey,
                                        schema: fieldSchema,
                                        value: fieldValue,
                                        isModified: isMod,
                                        isSecret: isSec,
                                        isRevealed: isRev,
                                        depth: 0,
                                        collapsedPaths: this.collapsedPaths,
                                        onToggleCollapse: this.toggleCollapse,
                                        onToggleReveal: this.toggleReveal,
                                        onChange: this.handleFieldChange,
                                      });
                                    },
                                  )
                                : html`<div style="color: var(--muted); font-size: 12px; padding: 12px 0;">
                                    No direct properties defined for this section.
                                  </div>`}
                            </div>
                          </div>
                        `
                      : html`<div style="color: var(--muted); font-size: 12px;">
                          Select a section from the left navigation.
                        </div>`}
                </div>
              </div>
            `}
      </div>
    `;
  }
}
