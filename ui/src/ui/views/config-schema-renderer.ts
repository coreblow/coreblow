import { html, type TemplateResult } from "lit";
import { renderIcon, type IconName } from "../icons.ts";

export interface JsonSchemaNode {
  $schema?: string;
  type?: string | string[];
  title?: string;
  description?: string;
  default?: unknown;
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  additionalProperties?: boolean | JsonSchemaNode;
  propertyNames?: JsonSchemaNode;
  items?: JsonSchemaNode | JsonSchemaNode[];
  enum?: unknown[];
  const?: unknown;
  anyOf?: JsonSchemaNode[];
  oneOf?: JsonSchemaNode[];
  allOf?: JsonSchemaNode[];
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
}

export interface SchemaSection {
  id: string;
  label: string;
  icon: IconName;
  description?: string;
  fieldCount: number;
  schema: JsonSchemaNode;
}

export interface FieldRenderContext {
  path: string;
  key: string;
  schema: JsonSchemaNode;
  value: unknown;
  isModified: boolean;
  isSecret: boolean;
  isRevealed: boolean;
  depth: number;
  collapsedPaths: Set<string>;
  onToggleCollapse: (path: string) => void;
  onToggleReveal: (path: string) => void;
  onChange: (path: string, newValue: unknown) => void;
}

export interface FlatFieldMatch {
  sectionId: string;
  path: string;
  key: string;
  label: string;
  schema: JsonSchemaNode;
}

export const SECTION_ICON_MAP: Record<string, IconName> = {
  gateway: "globe",
  agents: "bot",
  models: "spark",
  memory: "memoryBrain",
  tools: "wrench",
  channels: "radio",
  browser: "monitor",
  secrets: "lock", // pragma: allowlist secret
  auth: "shield",
  diagnostics: "gauge",
  logging: "scrollText",
  acp: "network",
  update: "refresh",
  ui: "palette",
  env: "sliders",
  cli: "terminal",
  bindings: "link",
  accessGroups: "users",
  nodeHost: "server",
  session: "fileText",
  cron: "clock",
  hooks: "webhook",
  web: "compass",
  discovery: "search",
  canvasHost: "layout",
  talk: "mic",
  mcp: "package",
  skills: "zap",
  plugins: "puzzle",
  commands: "command",
  approvals: "checkCircle",
  messages: "messageSquare",
  audio: "waveform",
  media: "image",
  broadcast: "megaphone",
  meta: "tag",
  wizard: "settings",
  presence: "radar",
  voicewake: "bell",
};

const PREFERRED_SECTION_ORDER: string[] = [
  "gateway",
  "agents",
  "models",
  "memory",
  "tools",
  "channels",
  "browser",
  "secrets", // pragma: allowlist secret
  "auth",
  "logging",
  "diagnostics",
  "acp",
  "update",
  "ui",
  "env",
  "cli",
  "bindings",
  "accessGroups",
  "nodeHost",
  "mcp",
  "skills",
  "plugins",
];

export function resolveSectionIcon(sectionId: string): IconName {
  return SECTION_ICON_MAP[sectionId] || "settings";
}

export function formatSectionLabel(key: string): string {
  const overrides: Record<string, string> = {
    acp: "ACP",
    ui: "UI",
    cli: "CLI",
    mcp: "MCP",
    env: "Environment",
    nodeHost: "Node Host",
    accessGroups: "Access Groups",
    canvasHost: "Canvas Host",
  };
  if (overrides[key]) return overrides[key];
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

export function resolveEnumOptions(schema: JsonSchemaNode): string[] | null {
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum.map(String);
  }
  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    const consts: string[] = [];
    for (const item of schema.anyOf) {
      if (item && item.const !== undefined) {
        consts.push(String(item.const));
      } else if (item && Array.isArray(item.enum)) {
        for (const val of item.enum) {
          consts.push(String(val));
        }
      }
    }
    if (consts.length > 0) return consts;
  }
  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    const consts: string[] = [];
    for (const item of schema.oneOf) {
      if (item && item.const !== undefined) {
        consts.push(String(item.const));
      }
    }
    if (consts.length > 0) return consts;
  }
  return null;
}

export function resolveNodeType(
  schema: JsonSchemaNode,
): "boolean" | "enum" | "number" | "string" | "array" | "object" | "json" {
  const enumOpts = resolveEnumOptions(schema);
  if (enumOpts && enumOpts.length > 0) {
    return "enum";
  }

  const rawType = Array.isArray(schema.type)
    ? schema.type.find((t) => t !== "null") || "string"
    : schema.type;

  if (rawType === "boolean") return "boolean";
  if (rawType === "integer" || rawType === "number") return "number";
  if (rawType === "string") return "string";
  if (rawType === "array") return "array";
  if (rawType === "object" || (schema.properties && Object.keys(schema.properties).length > 0)) {
    return "object";
  }

  if (schema.anyOf) {
    if (schema.anyOf.some((s) => s.type === "boolean")) return "boolean";
    if (schema.anyOf.some((s) => s.type === "object" || s.properties)) return "object";
    if (schema.anyOf.some((s) => s.type === "string")) return "string";
  }

  return "json";
}

export function countLeafFields(node: JsonSchemaNode, depth: number = 0): number {
  if (!node) return 0;
  if (node.properties && Object.keys(node.properties).length > 0 && depth < 2) {
    let count = 0;
    for (const child of Object.values(node.properties)) {
      count += countLeafFields(child, depth + 1);
    }
    return count > 0 ? count : 1;
  }
  return 1;
}

export function isSecretField(key: string, path: string): boolean {
  const lowerKey = key.toLowerCase();
  const lowerPath = path.toLowerCase();
  if (
    lowerKey.includes("token") ||
    lowerKey.includes("secret") ||
    lowerKey.includes("password") ||
    lowerKey.includes("apikey") ||
    lowerKey.includes("api_key")
  ) {
    return true;
  }
  if (
    /(^|_|\.)key($|_|\.)/.test(lowerKey) &&
    !lowerKey.includes("keyboard") &&
    !lowerKey.includes("keybinding") &&
    !lowerKey.includes("sessionkey") &&
    !lowerKey.includes("keytype")
  ) {
    return true;
  }
  if (lowerPath.endsWith(".token") || lowerPath.endsWith(".secret") || lowerPath.endsWith(".key")) {
    return true;
  }
  return false;
}

export function extractSchemaSections(schema: JsonSchemaNode): SchemaSection[] {
  if (!schema || !schema.properties) return [];
  const sections: SchemaSection[] = [];

  for (const [key, node] of Object.entries(schema.properties)) {
    const fieldCount = countLeafFields(node);
    sections.push({
      id: key,
      label: formatSectionLabel(key),
      icon: resolveSectionIcon(key),
      description: node.description,
      fieldCount,
      schema: node,
    });
  }

  return sections.sort((a, b) => {
    const orderA = PREFERRED_SECTION_ORDER.indexOf(a.id);
    const orderB = PREFERRED_SECTION_ORDER.indexOf(b.id);
    if (orderA !== -1 && orderB !== -1) return orderA - orderB;
    if (orderA !== -1) return -1;
    if (orderB !== -1) return 1;
    return a.label.localeCompare(b.label);
  });
}

export function getByPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = path.split(".");
  let curr: unknown = obj;
  for (const part of parts) {
    if (curr == null || typeof curr !== "object") return undefined;
    curr = (curr as Record<string, unknown>)[part];
  }
  return curr;
}

export function setByPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const parts = path.split(".");
  const root = { ...obj };
  let curr: Record<string, unknown> = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const next = curr[part];
    curr[part] = next && typeof next === "object" && !Array.isArray(next) ? { ...next } : {};
    curr = curr[part] as Record<string, unknown>;
  }
  curr[parts[parts.length - 1]] = value;
  return root;
}

export function searchSchemaFields(
  schema: JsonSchemaNode,
  query: string,
): FlatFieldMatch[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  const results: FlatFieldMatch[] = [];

  function walk(
    node: JsonSchemaNode,
    path: string,
    key: string,
    sectionId: string,
    depth: number,
  ) {
    if (!node) return;
    const label = formatSectionLabel(key);
    const matches =
      path.toLowerCase().includes(q) ||
      key.toLowerCase().includes(q) ||
      label.toLowerCase().includes(q) ||
      (node.description && node.description.toLowerCase().includes(q)) ||
      sectionId.toLowerCase().includes(q);

    if (node.properties && Object.keys(node.properties).length > 0 && depth < 2) {
      for (const [childKey, childNode] of Object.entries(node.properties)) {
        walk(
          childNode,
          path ? `${path}.${childKey}` : childKey,
          childKey,
          sectionId,
          depth + 1,
        );
      }
    } else {
      if (matches) {
        results.push({ sectionId, path, key, label, schema: node });
      }
    }
  }

  if (schema.properties) {
    for (const [secKey, secNode] of Object.entries(schema.properties)) {
      if (secNode.properties) {
        for (const [childKey, childNode] of Object.entries(secNode.properties)) {
          walk(childNode, `${secKey}.${childKey}`, childKey, secKey, 0);
        }
      } else {
        walk(secNode, secKey, secKey, secKey, 0);
      }
    }
  }

  return results;
}

export function renderSchemaField(ctx: FieldRenderContext): TemplateResult {
  const {
    path,
    key,
    schema,
    value,
    isModified,
    isSecret,
    isRevealed,
    depth,
    collapsedPaths,
    onToggleCollapse,
    onToggleReveal,
    onChange,
  } = ctx;

  const nodeType = resolveNodeType(schema);
  const enumOptions = resolveEnumOptions(schema);
  const fieldLabel = schema.title || formatSectionLabel(key);

  // Nested Object (up to depth 2)
  if (nodeType === "object" && schema.properties && depth < 2) {
    const isCollapsed = collapsedPaths.has(path);
    const childEntries = Object.entries(schema.properties);
    const childObj = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;

    return html`
      <div
        class="cb-schema-nested ${isModified ? "modified" : ""}"
        style="margin: 20px 0 10px;"
      >
        <div
          class="cb-nested-header"
          style="display: flex; align-items: center; gap: 10px; cursor: pointer; user-select: none; padding-bottom: 8px; border-bottom: 1px solid var(--border-subtle);"
          @click=${() => onToggleCollapse(path)}
        >
          <span style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-strong);">${fieldLabel}</span>
          <span style="font-size: 10px; font-family: var(--mono); color: var(--muted);">${path}</span>
          <div style="flex: 1; height: 1px; background: var(--border-subtle);"></div>
          <span style="font-size: 10px; color: var(--accent); font-family: var(--mono);">${isCollapsed ? "▶ expand" : "▼ collapse"}</span>
          <span
            style="font-size: 10px; padding: 1px 6px; border-radius: 8px; background: var(--surface-flat-muted); border: 1px solid var(--border-subtle); color: var(--muted); font-family: var(--mono);"
          >
            ${countLeafFields(schema, depth)} fields
          </span>
        </div>
        ${!isCollapsed
          ? html`
              <div style="display: flex; flex-direction: column; gap: 6px; padding-top: 8px;">
                ${childEntries.map(([childKey, childNode]) => {
                  const childPath = `${path}.${childKey}`;
                  const childValue = childObj[childKey];
                  const childSecret = isSecretField(childKey, childPath);
                  return renderSchemaField({
                    ...ctx,
                    path: childPath,
                    key: childKey,
                    schema: childNode,
                    value: childValue,
                    isModified: ctx.isModified,
                    isSecret: childSecret,
                    isRevealed: ctx.isRevealed,
                    depth: depth + 1,
                  });
                })}
              </div>
            `
          : ""}
      </div>
    `;
  }

  return html`
    <div
      class="cb-field-row ${isModified ? "is-modified" : ""}"
      style="display: flex; align-items: flex-start; justify-content: space-between; padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid ${isModified ? "var(--accent)" : "var(--border-subtle)"}; background: ${isModified ? "var(--surface-flat-hover)" : "var(--card)"}; gap: 16px; margin-bottom: 6px; transition: border-color 0.15s ease;"
    >
      <div style="flex: 1; min-width: 220px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 12px; font-weight: 600; color: var(--text-strong);">${fieldLabel}</span>
          ${isModified
            ? html`<span style="width: 6px; height: 6px; border-radius: 50%; background: var(--accent); display: inline-block;"></span>`
            : ""}
        </div>
        <div style="font-size: 11px; font-family: var(--mono); color: var(--muted); margin-top: 2px;">${path}</div>
        ${schema.description
          ? html`<div style="font-size: 11px; color: var(--text); opacity: 0.8; margin-top: 4px; line-height: 1.4;">${schema.description}</div>`
          : ""}
      </div>

      <div style="min-width: 260px; max-width: 440px; width: 100%; display: flex; justify-content: flex-end;">
        ${nodeType === "boolean"
          ? html`
              <button
                type="button"
                role="switch"
                aria-checked="${Boolean(value)}"
                class="cb-toggle-switch ${value ? "active" : ""}"
                style="width: 40px; height: 22px; border-radius: 11px; background: ${value ? "var(--accent)" : "var(--bg-muted)"}; border: 1px solid ${value ? "var(--accent)" : "var(--border-hairline)"}; cursor: pointer; position: relative; padding: 0; outline: none; transition: background 0.2s ease;"
                @click=${() => onChange(path, !value)}
              >
                <span
                  style="display: block; width: 16px; height: 16px; border-radius: 50%; background: ${value ? "var(--primary-foreground)" : "var(--muted)"}; position: absolute; top: 2px; left: ${value ? "20px" : "2px"}; transition: left 0.2s ease;"
                ></span>
              </button>
            `
          : nodeType === "enum" && enumOptions
            ? html`
                <select
                  style="width: 100%; background: var(--input, var(--bg-elevated)); border: 1px solid ${isModified ? "var(--accent)" : "var(--border-hairline)"}; border-radius: var(--radius-sm); color: var(--text-strong); padding: 7px 10px; font-size: 12px; font-family: var(--mono); outline: none;"
                  @change=${(e: Event) => onChange(path, (e.target as HTMLSelectElement).value)}
                >
                  <option value="" ?selected=${value === undefined || value === null}>-- select --</option>
                  ${enumOptions.map(
                    (opt) =>
                      html`<option value="${opt}" ?selected=${String(value ?? "") === opt}>${opt}</option>`,
                  )}
                </select>
              `
            : nodeType === "number"
              ? html`
                  <input
                    type="number"
                    style="width: 100%; background: var(--input, var(--bg-elevated)); border: 1px solid ${isModified ? "var(--accent)" : "var(--border-hairline)"}; border-radius: var(--radius-sm); color: var(--text-strong); padding: 7px 10px; font-size: 12px; font-family: var(--mono); outline: none;"
                    .value=${value !== undefined && value !== null ? String(value) : ""}
                    min=${schema.minimum ?? schema.exclusiveMinimum ?? ""}
                    max=${schema.maximum ?? schema.exclusiveMaximum ?? ""}
                    @change=${(e: Event) => {
                      const str = (e.target as HTMLInputElement).value;
                      onChange(path, str === "" ? undefined : Number(str));
                    }}
                  />
                `
              : nodeType === "array"
                ? html`
                    <input
                      type="text"
                      placeholder="comma-separated values"
                      style="width: 100%; background: var(--input, var(--bg-elevated)); border: 1px solid ${isModified ? "var(--accent)" : "var(--border-hairline)"}; border-radius: var(--radius-sm); color: var(--text-strong); padding: 7px 10px; font-size: 12px; font-family: var(--mono); outline: none;"
                      .value=${Array.isArray(value) ? value.join(", ") : ""}
                      @change=${(e: Event) => {
                        const raw = (e.target as HTMLInputElement).value.trim();
                        if (!raw) {
                          onChange(path, []);
                        } else {
                          const items = raw.split(",").map((s) => s.trim()).filter(Boolean);
                          const isNum =
                            (schema.items as JsonSchemaNode)?.type === "number" ||
                            (schema.items as JsonSchemaNode)?.type === "integer";
                          onChange(path, isNum ? items.map(Number) : items);
                        }
                      }}
                    />
                  `
                : nodeType === "string"
                  ? html`
                      <div style="position: relative; width: 100%; display: flex; align-items: center;">
                        <input
                          type=${isSecret && !isRevealed ? "password" : "text"}
                          placeholder=${schema.default !== undefined ? String(schema.default) : ""}
                          style="width: 100%; background: var(--input, var(--bg-elevated)); border: 1px solid ${isModified ? "var(--accent)" : "var(--border-hairline)"}; border-radius: var(--radius-sm); color: var(--text-strong); padding: 7px 10px; padding-right: ${isSecret ? "34px" : "10px"}; font-size: 12px; font-family: var(--mono); outline: none;"
                          .value=${value !== undefined && value !== null ? String(value) : ""}
                          @change=${(e: Event) => onChange(path, (e.target as HTMLInputElement).value)}
                        />
                        ${isSecret
                          ? html`
                              <button
                                type="button"
                                style="position: absolute; right: 6px; width: 22px; height: 22px; background: transparent; border: none; color: var(--muted); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;"
                                title=${isRevealed ? "Mask Secret" : "Reveal Secret"}
                                @click=${() => onToggleReveal(path)}
                              >
                                ${renderIcon(isRevealed ? "eyeOff" : "eye")}
                              </button>
                            `
                          : ""}
                      </div>
                    `
                  : html`
                      <textarea
                        rows="3"
                        style="width: 100%; background: var(--input, var(--bg-elevated)); border: 1px solid ${isModified ? "var(--accent)" : "var(--border-hairline)"}; border-radius: var(--radius-sm); color: var(--text-strong); padding: 6px 10px; font-size: 11px; font-family: var(--mono); resize: vertical; outline: none;"
                        .value=${typeof value === "object" && value !== null ? JSON.stringify(value, null, 2) : String(value ?? "{}")}
                        @change=${(e: Event) => {
                          const text = (e.target as HTMLTextAreaElement).value.trim();
                          try {
                            const parsed = JSON.parse(text);
                            onChange(path, parsed);
                          } catch {
                            onChange(path, text);
                          }
                        }}
                      ></textarea>
                    `}
      </div>
    </div>
  `;
}

/**
 * Compact Offline Schema Catalog covering CoreBlow's 18 core sections.
 * Guarantees zero blank screen when Gateway is offline.
 */
export const OFFLINE_SCHEMA_CATALOG: JsonSchemaNode = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    gateway: {
      type: "object",
      description: "Gateway loopback WebSocket server, auth token, and SQLite WAL storage",
      properties: {
        port: {
          type: "integer",
          minimum: 1,
          maximum: 65535,
          default: 18789,
          description: "Gateway control plane WebSocket & HTTP port",
        },
        mode: {
          type: "string",
          anyOf: [{ const: "local" }, { const: "remote" }, { const: "cluster" }],
          default: "local",
          description: "Gateway operating mode",
        },
        bind: {
          type: "string",
          anyOf: [{ const: "loopback" }, { const: "all" }, { const: "tailscale" }],
          default: "loopback",
          description: "Network binding interface",
        },
        customBindHost: {
          type: "string",
          default: "127.0.0.1",
          description: "Custom bind hostname/IP when bind is not loopback",
        },
        controlUi: {
          type: "boolean",
          default: true,
          description: "Serve Web Control UI over gateway HTTP",
        },
        auth: {
          type: "object",
          description: "Gateway client authentication credentials",
          properties: {
            token: {
              type: "string",
              description: "Secret token required for Gateway WebSocket connections",
            },
            required: {
              type: "boolean",
              default: false,
              description: "Enforce authentication token on loopback connections",
            },
          },
        },
        tailscale: {
          type: "boolean",
          default: false,
          description: "Expose Gateway via Tailscale Serve/Funnel",
        },
      },
    },
    agents: {
      type: "object",
      description: "Agent defaults, execution parameters, thinking levels, and turn limits",
      properties: {
        defaults: {
          type: "object",
          description: "Default execution config across all sessions",
          properties: {
            model: {
              type: "string",
              default: "gemini-2.5-pro",
              description: "Default primary LLM model identifier",
            },
            imageModel: {
              type: "string",
              description: "Specialized multimodal vision model identifier",
            },
            workspace: {
              type: "string",
              default: "~/.coreblow/workspace",
              description: "Default working directory for local agent execution",
            },
            thinkingDefault: {
              anyOf: [
                { const: "auto" },
                { const: "low" },
                { const: "high" },
                { const: "off" },
              ],
              default: "auto",
              description: "Default reasoning/thinking level for supported models",
            },
            contextTokens: {
              type: "integer",
              minimum: 1000,
              maximum: 2000000,
              default: 1000000,
              description: "Maximum context window size in tokens before compaction",
            },
            timeoutSeconds: {
              type: "integer",
              minimum: 10,
              maximum: 3600,
              default: 600,
              description: "Timeout for single agent tool execution turns",
            },
            maxConcurrent: {
              type: "integer",
              minimum: 1,
              maximum: 128,
              default: 16,
              description: "Maximum concurrent agent session runs",
            },
          },
        },
      },
    },
    models: {
      type: "object",
      description: "Model catalogs, provider slots, and fallback chains",
      properties: {
        default: {
          type: "string",
          default: "gemini-2.5-pro",
          description: "Global fallback model identifier",
        },
        providers: {
          type: "array",
          items: { type: "string" },
          default: ["google", "openai", "anthropic", "ollama", "openrouter"],
          description: "Active LLM provider backends enabled for inference",
        },
        mode: {
          type: "string",
          anyOf: [{ const: "direct" }, { const: "pool" }, { const: "fallback" }],
          default: "direct",
          description: "Inference routing strategy across pooled accounts",
        },
      },
    },
    memory: {
      type: "object",
      description: "Persistent SQLite WAL/FTS5 memory engine, citations, and QMD sidecar",
      properties: {
        backend: {
          type: "string",
          anyOf: [{ const: "builtin" }, { const: "qmd" }],
          default: "builtin",
          description: "Global memory engine: builtin CoreBlow SQLite FTS5 or QMD sidecar pipeline",
        },
        citations: {
          type: "string",
          anyOf: [{ const: "auto" }, { const: "on" }, { const: "off" }],
          default: "auto",
          description: "Controls memory citation visibility in agent replies",
        },
        qmd: {
          type: "object",
          description: "QMD sidecar retrieval & MCPorter daemon settings",
          properties: {
            command: {
              type: "string",
              default: "qmd",
              description: "Executable path for the qmd binary used by the QMD backend",
            },
            searchMode: {
              type: "string",
              anyOf: [{ const: "query" }, { const: "search" }, { const: "vsearch" }],
              default: "query",
              description: "QMD retrieval path (standard query, search, or vector vsearch)",
            },
            mcporterEnabled: {
              type: "boolean",
              default: false,
              description: "Route QMD calls through mcporter daemon to reduce cold-start overhead",
            },
          },
        },
      },
    },
    tools: {
      type: "object",
      description: "Tool execution security policies and approval gates",
      properties: {
        autoApprove: {
          type: "array",
          items: { type: "string" },
          default: ["read_file", "list_dir", "grep_search", "memory_search"],
          description: "Safe tools executed without operator confirmation",
        },
        requireApproval: {
          type: "array",
          items: { type: "string" },
          default: ["run_command", "write_file", "git_push", "screen_capture"],
          description: "Tools requiring explicit UI modal approval",
        },
        deny: {
          type: "array",
          items: { type: "string" },
          default: [],
          description: "Tools permanently blocked from agent execution",
        },
      },
    },
    channels: {
      type: "object",
      description: "External messaging channel adapters and peer isolation",
      properties: {
        telegram: {
          type: "object",
          properties: {
            enabled: { type: "boolean", default: false },
            botToken: { type: "string" },
            dmScope: {
              anyOf: [
                { const: "per-channel-peer" },
                { const: "per-peer" },
                { const: "main" },
              ],
              default: "per-channel-peer",
            },
          },
        },
        discord: {
          type: "object",
          properties: {
            enabled: { type: "boolean", default: false },
            token: { type: "string" },
          },
        },
        slack: {
          type: "object",
          properties: {
            enabled: { type: "boolean", default: false },
            botToken: { type: "string" },
            appToken: { type: "string" },
          },
        },
        signal: {
          type: "object",
          properties: {
            enabled: { type: "boolean", default: false },
            phone: { type: "string" },
          },
        },
        web: {
          type: "object",
          properties: {
            enabled: { type: "boolean", default: false },
            port: { type: "integer", default: 3000 },
          },
        },
      },
    },
    browser: {
      type: "object",
      description: "Headless Chromium browser automation and CDP control",
      properties: {
        enabled: { type: "boolean", default: true, description: "Enable browser tool agent capabilities" },
        headless: { type: "boolean", default: true, description: "Run Chromium in headless windowless mode" },
        cdpUrl: { type: "string", description: "Optional remote Chrome DevTools Protocol endpoint" },
        color: { type: "string", default: "forest-teal", description: "Browser tab accent theme color" },
        attachOnly: { type: "boolean", default: false, description: "Attach to existing browser without spawning new instances" },
      },
    },
    secrets: { // pragma: allowlist secret
      type: "object",
      description: "Vault and external keyring integrations for credential storage",
      properties: {
        providers: {
          type: "array",
          items: { type: "string" },
          default: ["local_keyring", "env", "1password"],
          description: "Ordered secret resolution provider sequence",
        },
      },
    },
    auth: {
      type: "object",
      description: "User authentication, profile authorization, and RBAC",
      properties: {
        profiles: {
          type: "object",
          properties: {
            defaultProfile: { type: "string", default: "default" },
            requireMfa: { type: "boolean", default: false },
          },
        },
      },
    },
    diagnostics: {
      type: "object",
      description: "Health checks, performance tracing, and crash analytics",
      properties: {
        enabled: { type: "boolean", default: true, description: "Enable background system diagnostics" },
        otel: { type: "boolean", default: false, description: "Export OpenTelemetry traces to collector" },
      },
    },
    logging: {
      type: "object",
      description: "Log verbosity levels, file sinks, and sensitive redaction",
      properties: {
        level: {
          anyOf: [
            { const: "silent" },
            { const: "fatal" },
            { const: "error" },
            { const: "warn" },
            { const: "info" },
            { const: "debug" },
            { const: "trace" },
          ],
          default: "info",
          description: "Global log filtering severity threshold",
        },
        file: {
          type: "string",
          default: "~/.coreblow/logs/gateway.log",
          description: "Path to primary rotating gateway log file",
        },
        consoleLevel: {
          anyOf: [
            { const: "silent" },
            { const: "error" },
            { const: "warn" },
            { const: "info" },
            { const: "debug" },
          ],
          default: "info",
          description: "Terminal stdout logging severity threshold",
        },
        consoleStyle: {
          anyOf: [{ const: "compact" }, { const: "pretty" }, { const: "json" }],
          default: "pretty",
          description: "Terminal log output formatting style",
        },
        redactSensitive: {
          type: "boolean",
          default: true,
          description: "Automatically mask API keys and secrets in logs",
        },
      },
    },
    acp: {
      type: "object",
      description: "Agent Control Protocol dispatch and multi-agent routing",
      properties: {
        enabled: { type: "boolean", default: false, description: "Enable ACP swarm orchestration" },
        dispatch: {
          type: "string",
          anyOf: [{ const: "auto" }, { const: "manual" }],
          default: "auto",
          description: "Task routing algorithm for ACP delegates",
        },
      },
    },
    update: {
      type: "object",
      description: "Release sync channels and auto-update policies",
      properties: {
        channel: {
          anyOf: [{ const: "stable" }, { const: "beta" }, { const: "nightly" }],
          default: "stable",
          description: "Software release distribution channel",
        },
        autoUpdate: {
          type: "boolean",
          default: false,
          description: "Automatically apply minor/patch release updates",
        },
      },
    },
    ui: {
      type: "object",
      description: "Web Control UI visual tokens, themes, and branding",
      properties: {
        theme: {
          anyOf: [{ const: "core" }, { const: "obsidian" }, { const: "coredash" }],
          default: "obsidian",
          description: "Visual surface theme family",
        },
        accentColor: {
          type: "string",
          default: "forest-teal",
          description: "Brand accent tint (#2dd4bf / forest-teal)",
        },
        assistantName: {
          type: "string",
          default: "CoreBlow",
          description: "Display name for the agent assistant in chat",
        },
      },
    },
    env: {
      type: "object",
      description: "Shell environment inheritance and dynamic environment variables",
      properties: {
        shellEnv: {
          type: "object",
          properties: {
            enabled: { type: "boolean", default: true, description: "Inherit parent login shell environment" },
            timeoutMs: { type: "integer", default: 5000, description: "Login shell probe timeout in ms" },
          },
        },
        vars: {
          type: "object",
          additionalProperties: { type: "string" },
          description: "Explicit environment variables passed to tools",
        },
      },
    },
    cli: {
      type: "object",
      description: "CLI terminal display preferences and color palette",
      properties: {
        banner: { type: "boolean", default: true, description: "Show CoreBlow Quiet-Instrument CLI startup banner" },
        colors: { type: "boolean", default: true, description: "Enable ANSI 256-color output in terminal" },
      },
    },
    bindings: {
      type: "object",
      description: "Channel to agent profile routing bindings",
      properties: {
        defaultProfile: {
          type: "string",
          default: "local",
          description: "Default agent profile bound to incoming messages",
        },
      },
    },
    accessGroups: {
      type: "object",
      description: "Security access groups for command and tool gating",
      properties: {
        defaultGroup: {
          type: "string",
          default: "admin",
          description: "Default security access tier assigned to local operators",
        },
      },
    },
    nodeHost: {
      type: "object",
      description: "Distributed execution node host daemon parameters",
      properties: {
        enabled: { type: "boolean", default: false, description: "Enable node daemon listener" },
        port: { type: "integer", default: 18790, description: "Peer node host listening port" },
      },
    },
  },
};
