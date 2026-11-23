import { LitElement, html, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { CoreBlowApp } from "../app.ts";
import { renderIcon, type IconName } from "../icons.ts";

export interface ModelEntry {
  id: string;
  displayName: string;
  provider: string;
  contextWindow: number;
  maxOutput?: number;
  tags: string[];
  description?: string;
  isPrimary?: boolean;
  isFallback?: boolean;
}

export interface ProviderSlot {
  id: string;
  name: string;
  icon: IconName;
  description: string;
  configured: boolean;
  enabled: boolean;
  keyMasked?: string;
  baseUrl?: string;
}

export const OFFLINE_MODELS_CATALOG: ModelEntry[] = [
  {
    id: "gemini-2.5-pro",
    displayName: "Gemini 2.5 Pro",
    provider: "google",
    contextWindow: 1_048_576,
    maxOutput: 65_536,
    tags: ["flagship", "thinking", "vision", "tools"],
    description: "Google frontier model with 1M token context, deep multimodal reasoning, and tool use.",
    isPrimary: true,
  },
  {
    id: "gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    provider: "google",
    contextWindow: 1_048_576,
    maxOutput: 65_536,
    tags: ["fast", "thinking", "low-latency"],
    description: "High-throughput sub-second reasoning model with 1M context window.",
  },
  {
    id: "claude-3-7-sonnet",
    displayName: "Claude 3.7 Sonnet",
    provider: "anthropic",
    contextWindow: 200_000,
    maxOutput: 64_000,
    tags: ["flagship", "hybrid-reasoning", "coding"],
    description: "Hybrid instantaneous reasoning and deliberate deep thinking for complex engineering.",
    isFallback: true,
  },
  {
    id: "claude-3-5-haiku",
    displayName: "Claude 3.5 Haiku",
    provider: "anthropic",
    contextWindow: 200_000,
    maxOutput: 8_192,
    tags: ["fast", "efficient"],
    description: "Ultra-fast response model for routing, summarization, and lightweight tasks.",
  },
  {
    id: "gpt-4o",
    displayName: "GPT-4o",
    provider: "openai",
    contextWindow: 128_000,
    maxOutput: 16_384,
    tags: ["flagship", "vision", "tools"],
    description: "Omni model for general-purpose multi-modal tasks and function execution.",
  },
  {
    id: "gpt-4o-mini",
    displayName: "GPT-4o Mini",
    provider: "openai",
    contextWindow: 128_000,
    maxOutput: 16_384,
    tags: ["fast", "cheap"],
    description: "Lightweight and cost-effective model for high-frequency operations.",
  },
  {
    id: "o3-mini",
    displayName: "o3-mini",
    provider: "openai",
    contextWindow: 200_000,
    maxOutput: 100_000,
    tags: ["reasoning", "math", "code"],
    description: "High-performance reasoning model optimized for math, science, and coding.",
  },
  {
    id: "deepseek-chat",
    displayName: "DeepSeek V3",
    provider: "deepseek",
    contextWindow: 64_000,
    maxOutput: 8_000,
    tags: ["general", "code"],
    description: "Cost-efficient 671B MoE architecture with strong multi-turn coding performance.",
  },
  {
    id: "deepseek-reasoner",
    displayName: "DeepSeek R1",
    provider: "deepseek",
    contextWindow: 64_000,
    maxOutput: 8_000,
    tags: ["reasoning", "open-weights"],
    description: "Frontier open-weights reasoning model with explicit verification chains.",
  },
  {
    id: "ollama/llama3.3",
    displayName: "Llama 3.3 70B (Local)",
    provider: "ollama",
    contextWindow: 131_072,
    maxOutput: 8_192,
    tags: ["local", "privacy", "open-weights"],
    description: "Sovereign local inference on private hardware via Ollama HTTP bridge.",
  },
  {
    id: "openrouter/auto",
    displayName: "OpenRouter Auto",
    provider: "openrouter",
    contextWindow: 128_000,
    maxOutput: 16_384,
    tags: ["router", "fallback"],
    description: "Dynamic multi-provider routing gateway with automatic rate-limit fallback.",
  },
];

export const OFFLINE_PROVIDERS: ProviderSlot[] = [
  {
    id: "google",
    name: "Google Gemini",
    icon: "spark",
    description: "Gemini API with native structured outputs, 1M context, and vision.",
    configured: true,
    enabled: true,
    keyMasked: "••••••••••••••••••••", // pragma: allowlist secret
  },
  {
    id: "anthropic",
    name: "Anthropic",
    icon: "brain",
    description: "Claude API with prompt caching, computer use, and hybrid reasoning.",
    configured: true,
    enabled: true,
    keyMasked: "••••••••••••••••••••", // pragma: allowlist secret
  },
  {
    id: "openai",
    name: "OpenAI",
    icon: "zap",
    description: "GPT and reasoning models with function calling and JSON mode.",
    configured: true,
    enabled: true,
    keyMasked: "••••••••••••••••••••", // pragma: allowlist secret
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    icon: "network",
    description: "Direct API endpoint for DeepSeek V3 and R1 reasoning engines.",
    configured: false,
    enabled: false,
  },
  {
    id: "ollama",
    name: "Ollama (Local)",
    icon: "package",
    description: "Local private model server (default: http://127.0.0.1:11434).",
    configured: true,
    enabled: true,
    baseUrl: "http://127.0.0.1:11434",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    icon: "compass",
    description: "Unified aggregator for multi-provider fallback and spot pricing.",
    configured: false,
    enabled: false,
  },
];

@customElement("coreblow-models-view")
export class ModelsView extends LitElement {
  @property({ attribute: false }) app!: CoreBlowApp;

  @state() models: ModelEntry[] = [...OFFLINE_MODELS_CATALOG];
  @state() providers: ProviderSlot[] = [...OFFLINE_PROVIDERS];
  @state() primaryModel = "gemini-2.5-pro";
  @state() fallbackModel = "claude-3-7-sonnet";
  @state() routingMode: "direct" | "pool" | "fallback" = "direct";
  @state() loading = false;
  @state() searchQuery = "";
  @state() selectedProvider = "all";
  @state() revealedKeys: Set<string> = new Set();
  @state() editedKeys: Map<string, string> = new Map();
  @state() baseHash: string | null = null;
  @state() statusMessage: { text: string; success: boolean } | null = null;
  @state() expandedProviderId: string | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    void this.loadModelsAndConfig();
  }

  protected updated(changedProperties: PropertyValues): void {
    if (changedProperties.has("app")) {
      const prevApp = changedProperties.get("app") as CoreBlowApp | undefined;
      if (prevApp?.connected !== this.app?.connected) {
        void this.loadModelsAndConfig();
      }
    }
  }

  async loadModelsAndConfig() {
    const client = this.app?.gateway?.getClient();
    if (!client?.connected) {
      this.syncActiveFlags();
      return;
    }

    this.loading = true;
    try {
      // 1. Fetch live allowed models
      try {
        const modelsRes = await client.request<{
          models?: Array<{
            id: string;
            name?: string;
            displayName?: string;
            provider?: string;
            contextWindow?: number;
            maxOutput?: number;
            tags?: string[];
            capabilities?: string[];
            reasoning?: boolean;
          }>;
        }>("models.list", {});

        if (modelsRes?.models && modelsRes.models.length > 0) {
          this.models = modelsRes.models.map((m) => {
            const fallback = OFFLINE_MODELS_CATALOG.find((cat) => cat.id === m.id);
            const provider = m.provider || (m.id.includes("/") ? m.id.split("/")[0] : fallback?.provider || "openai");
            const tags = m.tags || m.capabilities || fallback?.tags || [];
            if (m.reasoning && !tags.includes("reasoning")) {
              tags.push("reasoning");
            }
            return {
              id: m.id,
              displayName: m.displayName || m.name || fallback?.displayName || m.id,
              provider,
              contextWindow: m.contextWindow || fallback?.contextWindow || 128_000,
              maxOutput: m.maxOutput || fallback?.maxOutput,
              tags,
              description: fallback?.description || `${m.displayName || m.id} via ${provider}`,
            };
          });
        }
      } catch (err) {
        console.warn("Failed to load models list from gateway:", err);
      }

      // 2. Fetch config for primary, fallback, mode, and providers
      try {
        const configResult = await client.request<{
          config?: {
            agents?: { defaults?: { model?: string } };
            models?: {
              default?: string;
              mode?: "direct" | "pool" | "fallback";
              providers?: Record<string, { enabled?: boolean; apiKey?: string; baseUrl?: string }>;
            };
          };
          baseHash?: string;
          hash?: string;
        }>("config.get", {});

        this.baseHash = configResult?.baseHash ?? configResult?.hash ?? null;
        const cfg = configResult?.config;

        if (cfg?.agents?.defaults?.model) {
          this.primaryModel = cfg.agents.defaults.model;
        }
        if (cfg?.models?.default) {
          this.fallbackModel = cfg.models.default;
        }
        if (cfg?.models?.mode) {
          this.routingMode = cfg.models.mode;
        }

        if (cfg?.models?.providers) {
          this.providers = this.providers.map((p) => {
            const cp = cfg.models?.providers?.[p.id];
            if (!cp) return p;
            return {
              ...p,
              enabled: cp.enabled ?? p.enabled,
              configured: Boolean(cp.apiKey || cp.baseUrl || p.configured),
              baseUrl: cp.baseUrl || p.baseUrl,
              keyMasked: cp.apiKey ? `${cp.apiKey.slice(0, 6)}••••••••••••` : p.keyMasked,
            };
          });
        }
      } catch (err) {
        console.warn("Failed to load models config:", err);
      }

      this.syncActiveFlags();
    } finally {
      this.loading = false;
    }
  }

  private syncActiveFlags() {
    this.models = this.models.map((m) => ({
      ...m,
      isPrimary: m.id === this.primaryModel,
      isFallback: m.id === this.fallbackModel,
    }));
  }

  async setPrimaryModel(modelId: string) {
    this.primaryModel = modelId;
    this.syncActiveFlags();

    const client = this.app?.gateway?.getClient();
    if (!client?.connected) {
      this.statusMessage = { text: `Primary model set to ${modelId} (offline mode).`, success: true };
      return;
    }

    try {
      await client.request("config.patch", {
        raw: JSON.stringify({
          agents: { defaults: { model: modelId } },
        }),
        baseHash: this.baseHash,
      });
      this.statusMessage = { text: `Default primary model set to ${modelId}.`, success: true };
    } catch (err) {
      this.statusMessage = { text: `Failed to set primary model: ${String(err)}`, success: false };
    }
  }

  async setFallbackModel(modelId: string) {
    this.fallbackModel = modelId;
    this.syncActiveFlags();

    const client = this.app?.gateway?.getClient();
    if (!client?.connected) {
      this.statusMessage = { text: `Fallback model set to ${modelId} (offline mode).`, success: true };
      return;
    }

    try {
      await client.request("config.patch", {
        raw: JSON.stringify({
          models: { default: modelId },
        }),
        baseHash: this.baseHash,
      });
      this.statusMessage = { text: `Fallback model set to ${modelId}.`, success: true };
    } catch (err) {
      this.statusMessage = { text: `Failed to set fallback model: ${String(err)}`, success: false };
    }
  }

  async setRoutingMode(mode: "direct" | "pool" | "fallback") {
    this.routingMode = mode;

    const client = this.app?.gateway?.getClient();
    if (!client?.connected) {
      this.statusMessage = { text: `Routing mode updated to ${mode} (offline mode).`, success: true };
      return;
    }

    try {
      await client.request("config.patch", {
        raw: JSON.stringify({
          models: { mode },
        }),
        baseHash: this.baseHash,
      });
      this.statusMessage = { text: `Routing mode set to ${mode}.`, success: true };
    } catch (err) {
      this.statusMessage = { text: `Failed to set routing mode: ${String(err)}`, success: false };
    }
  }

  async toggleProviderEnabled(slot: ProviderSlot) {
    slot.enabled = !slot.enabled;
    this.requestUpdate();

    const client = this.app?.gateway?.getClient();
    if (!client?.connected) return;

    try {
      await client.request("config.patch", {
        raw: JSON.stringify({
          models: {
            providers: {
              [slot.id]: { enabled: slot.enabled },
            },
          },
        }),
        baseHash: this.baseHash,
      });
    } catch (err) {
      console.warn("Failed to toggle provider enabled:", err);
    }
  }

  async saveApiKey(slot: ProviderSlot) {
    const key = this.editedKeys.get(slot.id);
    if (!key) return;

    slot.configured = true;
    slot.keyMasked = `${key.slice(0, 6)}••••••••••••`;
    this.editedKeys.delete(slot.id);
    this.requestUpdate();

    const client = this.app?.gateway?.getClient();
    if (!client?.connected) {
      this.statusMessage = { text: `API key for ${slot.name} saved locally (offline).`, success: true };
      return;
    }

    try {
      await client.request("config.patch", {
        raw: JSON.stringify({
          models: {
            providers: {
              [slot.id]: { apiKey: key, enabled: true },
            },
          },
        }),
        baseHash: this.baseHash,
      });
      this.statusMessage = { text: `API key for ${slot.name} updated.`, success: true };
    } catch (err) {
      this.statusMessage = { text: `Failed to save API key: ${String(err)}`, success: false };
    }
  }

  private toggleRevealKey(id: string) {
    if (this.revealedKeys.has(id)) {
      this.revealedKeys.delete(id);
    } else {
      this.revealedKeys.add(id);
    }
    this.requestUpdate();
  }

  private formatContext(tokens: number): string {
    if (tokens >= 1_000_000) {
      return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, "")}M ctx`;
    }
    if (tokens >= 1_000) {
      return `${Math.round(tokens / 1_000)}k ctx`;
    }
    return `${tokens} ctx`;
  }

  render() {
    const isOnline = Boolean(this.app?.connected);
    const query = this.searchQuery.trim().toLowerCase();

    const filteredModels = this.models.filter((m) => {
      const matchesProvider = this.selectedProvider === "all" || m.provider === this.selectedProvider;
      if (!matchesProvider) return false;
      if (!query) return true;
      return (
        m.id.toLowerCase().includes(query) ||
        m.displayName.toLowerCase().includes(query) ||
        m.provider.toLowerCase().includes(query) ||
        m.tags.some((t) => t.toLowerCase().includes(query))
      );
    });

    const activeProviders = this.providers.filter((p) => p.configured && p.enabled).length;

    return html`
      <div style="max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px;">
        <!-- Header -->
        <div style="display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
          <div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <h1 style="font-size: 20px; font-weight: 700; margin: 0; color: var(--text-strong); letter-spacing: -0.01em;">
                Models &amp; Providers
              </h1>
              <span
                style="display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: var(--radius-full); border: 1px solid ${isOnline ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}; background: ${isOnline ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)"}; color: ${isOnline ? "var(--ok, #22c55e)" : "var(--danger, #f87171)"};"
              >
                <span style="width: 6px; height: 6px; border-radius: 50%; background: ${isOnline ? "var(--ok, #22c55e)" : "var(--danger, #f87171)"};"></span>
                ${isOnline ? "Gateway Live" : "Offline Defaults"}
              </span>
            </div>
            <p style="margin: 4px 0 0; font-size: 13px; color: var(--muted); line-height: 1.4;">
              Manage CoreBlow's 8-backend model router, active primary defaults, fallback chains, and provider credentials.
            </p>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <!-- Routing Mode Selector -->
            <div style="display: flex; align-items: center; gap: 6px; background: var(--card); border: 1px solid var(--border-hairline); padding: 4px 10px; border-radius: var(--radius-sm); font-size: 12px;">
              <span style="color: var(--muted); font-size: 11px; text-transform: uppercase; font-weight: 600;">Mode</span>
              <select
                style="background: transparent; border: none; color: var(--accent); font-weight: 600; font-size: 12px; cursor: pointer; outline: none;"
                .value=${this.routingMode}
                @change=${(e: Event) => this.setRoutingMode((e.target as HTMLSelectElement).value as any)}
              >
                <option value="direct" ?selected=${this.routingMode === "direct"}>Direct Execution</option>
                <option value="fallback" ?selected=${this.routingMode === "fallback"}>Fallback Chain</option>
                <option value="pool" ?selected=${this.routingMode === "pool"}>Load Pool</option>
              </select>
            </div>

            <!-- Refresh Button -->
            <button
              type="button"
              style="display: flex; align-items: center; gap: 6px; background: var(--card); border: 1px solid var(--border-hairline); padding: 6px 12px; border-radius: var(--radius-sm); color: var(--text-strong); font-size: 11px; font-weight: 500; cursor: pointer;"
              title="Reload model catalog from gateway"
              @click=${() => void this.loadModelsAndConfig()}
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

        <!-- Active Primary & Fallback Summary Strip -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px;">
          <!-- Primary Model Card -->
          <div
            style="background: var(--card); border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--border-hairline)); border-radius: var(--radius-sm); padding: 14px 16px; display: flex; flex-direction: column; gap: 6px;"
          >
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--accent); letter-spacing: 0.04em;">
                Primary Default Model
              </span>
              <span style="font-size: 11px; padding: 1px 6px; border-radius: 4px; background: rgba(20, 184, 166, 0.15); color: var(--accent); font-weight: 600;">
                Active
              </span>
            </div>
            <div style="font-size: 15px; font-weight: 700; color: var(--text-strong); font-family: var(--mono);">
              ${this.primaryModel}
            </div>
            <div style="font-size: 11px; color: var(--muted);">
              Routed automatically for primary conversational reasoning and turn execution.
            </div>
          </div>

          <!-- Fallback Model Card -->
          <div
            style="background: var(--card); border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); padding: 14px 16px; display: flex; flex-direction: column; gap: 6px;"
          >
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--muted); letter-spacing: 0.04em;">
                Fallback Model
              </span>
              <span style="font-size: 11px; padding: 1px 6px; border-radius: 4px; background: var(--surface-flat-muted); color: var(--muted); font-weight: 600;">
                Standby
              </span>
            </div>
            <div style="font-size: 15px; font-weight: 700; color: var(--text-strong); font-family: var(--mono);">
              ${this.fallbackModel}
            </div>
            <div style="font-size: 11px; color: var(--muted);">
              Invoked seamlessly on rate-limit (429), provider outage, or token threshold overflow.
            </div>
          </div>

          <!-- Providers Status Card -->
          <div
            style="background: var(--card); border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); padding: 14px 16px; display: flex; flex-direction: column; gap: 6px;"
          >
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--muted); letter-spacing: 0.04em;">
                Active Providers
              </span>
              <span style="font-size: 11px; padding: 1px 6px; border-radius: 4px; background: rgba(34, 197, 94, 0.12); color: var(--ok, #22c55e); font-weight: 600;">
                ${activeProviders} / ${this.providers.length} Ready
              </span>
            </div>
            <div style="font-size: 15px; font-weight: 700; color: var(--text-strong);">
              ${this.providers.filter((p) => p.configured && p.enabled).map((p) => p.name.split(" ")[0]).join(", ") || "None"}
            </div>
            <div style="font-size: 11px; color: var(--muted);">
              Configured API backends ready for dynamic model routing.
            </div>
          </div>
        </div>

        <!-- Provider Credentials Slots (Collapsible / Accordion) -->
        <div style="background: var(--card); border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); overflow: hidden;">
          <div
            style="padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); background: var(--surface-flat-muted); cursor: pointer;"
            @click=${() =>
              (this.expandedProviderId = this.expandedProviderId === "all-providers" ? null : "all-providers")}
          >
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="color: var(--accent); width: 14px; height: 14px;">${renderIcon("shield")}</span>
              <span style="font-size: 13px; font-weight: 600; color: var(--text-strong);">
                Provider Credentials &amp; API Keys
              </span>
              <span style="font-size: 11px; color: var(--muted);">(${activeProviders} configured)</span>
            </div>
            <button
              type="button"
              style="background: transparent; border: none; color: var(--muted); cursor: pointer; font-size: 11px; font-weight: 600; text-transform: uppercase;"
            >
              ${this.expandedProviderId === "all-providers" ? "Hide Keys" : "Configure Keys"}
            </button>
          </div>

          ${this.expandedProviderId === "all-providers"
            ? html`
                <div style="padding: 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px;">
                  ${this.providers.map((p) => {
                    const isRevealed = this.revealedKeys.has(p.id);
                    const editedValue = this.editedKeys.get(p.id);
                    const displayValue = editedValue !== undefined ? editedValue : isRevealed ? (p.keyMasked || "") : (p.keyMasked || "");

                    return html`
                      <div
                        style="border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); padding: 12px; background: var(--bg); display: flex; flex-direction: column; gap: 8px;"
                      >
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                          <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="color: var(--accent); width: 14px; height: 14px;">${renderIcon(p.icon)}</span>
                            <span style="font-size: 12px; font-weight: 600; color: var(--text-strong);">${p.name}</span>
                          </div>
                          <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 11px; color: var(--muted);">
                            <input
                              type="checkbox"
                              style="accent-color: var(--accent);"
                              .checked=${p.enabled}
                              @change=${() => this.toggleProviderEnabled(p)}
                            />
                            Enabled
                          </label>
                        </div>

                        ${p.id === "ollama"
                          ? html`
                              <div style="font-size: 11px; color: var(--muted);">
                                Base URL: <code style="font-family: var(--mono); color: var(--text-strong);">${p.baseUrl || "http://127.0.0.1:11434"}</code>
                              </div>
                            `
                          : html`
                              <div style="display: flex; align-items: center; gap: 6px;">
                                <input
                                  type=${isRevealed ? "text" : "password"}
                                  placeholder="Enter ${p.name} API Key"
                                  style="flex: 1; background: var(--card); border: 1px solid var(--border-hairline); color: var(--text-strong); font-family: var(--mono); font-size: 11px; padding: 6px 10px; border-radius: var(--radius-sm); outline: none;"
                                  .value=${displayValue}
                                  @input=${(e: Event) => {
                                    const val = (e.target as HTMLInputElement).value;
                                    this.editedKeys.set(p.id, val);
                                    this.requestUpdate();
                                  }}
                                />
                                <button
                                  type="button"
                                  style="background: var(--surface-flat-muted); border: 1px solid var(--border-hairline); color: var(--muted); padding: 6px 8px; border-radius: var(--radius-sm); cursor: pointer;"
                                  title=${isRevealed ? "Hide Key" : "Reveal Key"}
                                  @click=${() => this.toggleRevealKey(p.id)}
                                >
                                  <span style="width: 12px; height: 12px; display: block;">
                                    ${renderIcon(isRevealed ? "eyeOff" : "eye")}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  style="background: var(--surface-flat-hover); border: 1px solid var(--border-hairline); color: var(--accent); padding: 6px 12px; border-radius: var(--radius-sm); font-size: 11px; font-weight: 600; cursor: pointer;"
                                  ?disabled=${!this.editedKeys.has(p.id)}
                                  @click=${() => this.saveApiKey(p)}
                                >
                                  Save
                                </button>
                              </div>
                            `}
                        <div style="font-size: 11px; color: var(--muted);">${p.description}</div>
                      </div>
                    `;
                  })}
                </div>
              `
            : ""}
        </div>

        <!-- Filter & Search Bar -->
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <button
              type="button"
              style="background: ${this.selectedProvider === "all" ? "var(--accent)" : "var(--card)"}; color: ${this.selectedProvider === "all" ? "#fff" : "var(--text)"}; border: 1px solid ${this.selectedProvider === "all" ? "var(--accent)" : "var(--border-hairline)"}; padding: 4px 10px; border-radius: var(--radius-sm); font-size: 11px; font-weight: 600; cursor: pointer;"
              @click=${() => (this.selectedProvider = "all")}
            >
              All Providers (${this.models.length})
            </button>
            ${["google", "anthropic", "openai", "deepseek", "ollama", "openrouter"].map(
              (prov) => html`
                <button
                  type="button"
                  style="background: ${this.selectedProvider === prov ? "var(--accent)" : "var(--card)"}; color: ${this.selectedProvider === prov ? "#fff" : "var(--muted)"}; border: 1px solid ${this.selectedProvider === prov ? "var(--accent)" : "var(--border-hairline)"}; padding: 4px 10px; border-radius: var(--radius-sm); font-size: 11px; font-weight: 600; text-transform: capitalize; cursor: pointer;"
                  @click=${() => (this.selectedProvider = prov)}
                >
                  ${prov}
                </button>
              `,
            )}
          </div>

          <div style="position: relative; min-width: 240px;">
            <input
              type="text"
              placeholder="Search models by name or id..."
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
        </div>

        <!-- Models Catalog Flat Table -->
        <div style="background: var(--card); border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); overflow: hidden;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12px;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-hairline); background: var(--surface-flat-muted); color: var(--muted); font-size: 11px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.03em;">
                <th style="padding: 10px 14px;">Model ID / Name</th>
                <th style="padding: 10px 14px;">Provider</th>
                <th style="padding: 10px 14px;">Context Window</th>
                <th style="padding: 10px 14px;">Capabilities</th>
                <th style="padding: 10px 14px; text-align: right;">Routing Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filteredModels.length === 0
                ? html`
                    <tr>
                      <td colspan="5" style="padding: 32px; text-align: center; color: var(--muted);">
                        No models match the filter query "${this.searchQuery}".
                      </td>
                    </tr>
                  `
                : filteredModels.map((m) => {
                    const isPrim = m.id === this.primaryModel;
                    const isFall = m.id === this.fallbackModel;

                    return html`
                      <tr
                        style="border-bottom: 1px solid var(--border-subtle); transition: background 0.15s ease;"
                        onmouseover="this.style.background='var(--surface-flat-hover)'"
                        onmouseout="this.style.background='transparent'"
                      >
                        <td style="padding: 10px 14px;">
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <div>
                              <div style="font-weight: 600; color: var(--text-strong);">${m.displayName}</div>
                              <div style="font-family: var(--mono); font-size: 11px; color: var(--muted);">${m.id}</div>
                            </div>
                            ${isPrim
                              ? html`
                                  <span style="font-size: 10px; font-weight: 600; background: rgba(20, 184, 166, 0.15); color: var(--accent); padding: 1px 6px; border-radius: 4px;">
                                    PRIMARY
                                  </span>
                                `
                              : ""}
                            ${isFall
                              ? html`
                                  <span style="font-size: 10px; font-weight: 600; background: var(--surface-flat-muted); color: var(--muted); padding: 1px 6px; border-radius: 4px;">
                                    FALLBACK
                                  </span>
                                `
                              : ""}
                          </div>
                        </td>

                        <td style="padding: 10px 14px;">
                          <span
                            style="display: inline-block; padding: 2px 7px; border-radius: var(--radius-sm); font-size: 10px; font-weight: 600; text-transform: uppercase; border: 1px solid var(--border-hairline); background: var(--surface-flat-muted); color: var(--text-strong);"
                          >
                            ${m.provider}
                          </span>
                        </td>

                        <td style="padding: 10px 14px; font-family: var(--mono); color: var(--text-strong);">
                          ${this.formatContext(m.contextWindow)}
                        </td>

                        <td style="padding: 10px 14px;">
                          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                            ${m.tags.map(
                              (t) => html`
                                <span
                                  style="font-size: 10px; padding: 1px 5px; border-radius: 3px; background: var(--surface-flat-muted); color: var(--muted);"
                                >
                                  ${t}
                                </span>
                              `,
                            )}
                          </div>
                        </td>

                        <td style="padding: 10px 14px; text-align: right;">
                          <div style="display: inline-flex; align-items: center; gap: 6px;">
                            <button
                              type="button"
                              style="background: ${isPrim ? "transparent" : "var(--surface-flat-hover)"}; border: 1px solid ${isPrim ? "transparent" : "var(--border-hairline)"}; color: ${isPrim ? "var(--muted)" : "var(--accent)"}; padding: 4px 8px; border-radius: var(--radius-sm); font-size: 11px; font-weight: 600; cursor: ${isPrim ? "default" : "pointer"};"
                              ?disabled=${isPrim}
                              @click=${() => this.setPrimaryModel(m.id)}
                            >
                              ${isPrim ? "✓ Primary" : "Set Primary"}
                            </button>
                            <button
                              type="button"
                              style="background: ${isFall ? "transparent" : "var(--surface-flat-muted)"}; border: 1px solid ${isFall ? "transparent" : "var(--border-hairline)"}; color: ${isFall ? "var(--muted)" : "var(--text)"}; padding: 4px 8px; border-radius: var(--radius-sm); font-size: 11px; font-weight: 500; cursor: ${isFall ? "default" : "pointer"};"
                              ?disabled=${isFall}
                              @click=${() => this.setFallbackModel(m.id)}
                            >
                              ${isFall ? "✓ Fallback" : "Set Fallback"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    `;
                  })}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
}
