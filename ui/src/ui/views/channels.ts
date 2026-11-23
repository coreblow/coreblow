import { LitElement, html, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { CoreBlowApp } from "../app.ts";
import { renderIcon, type IconName } from "../icons.ts";

export interface ChannelEntry {
  id: string;
  name: string;
  icon: IconName;
  description: string;
  enabled: boolean;
  configured: boolean;
  connected: boolean;
  accountId: string;
  dmScope: "per-channel-peer" | "per-peer" | "main";
  botToken?: string;
  lastInboundAt?: number | null;
  lastOutboundAt?: number | null;
}

export const OFFLINE_CHANNEL_CATALOG: ChannelEntry[] = [
  {
    id: "telegram",
    name: "Telegram",
    icon: "send",
    description: "Direct bot API adapter for Telegram channels, groups, and direct messages.",
    enabled: false,
    configured: false,
    connected: false,
    accountId: "default",
    dmScope: "per-channel-peer",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: "messageSquare",
    description: "WhatsApp Web provider session via multi-device socket connection.",
    enabled: false,
    configured: false,
    connected: false,
    accountId: "default",
    dmScope: "per-channel-peer",
  },
  {
    id: "discord",
    name: "Discord",
    icon: "radio",
    description: "Discord Gateway bot connection with slash commands and thread awareness.",
    enabled: false,
    configured: false,
    connected: false,
    accountId: "default",
    dmScope: "per-channel-peer",
  },
  {
    id: "slack",
    name: "Slack",
    icon: "network",
    description: "Slack Socket Mode client with app mentions and thread routing.",
    enabled: false,
    configured: false,
    connected: false,
    accountId: "default",
    dmScope: "per-channel-peer",
  },
  {
    id: "signal",
    name: "Signal",
    icon: "shield",
    description: "Signal daemon bridge for end-to-end encrypted messaging.",
    enabled: false,
    configured: false,
    connected: false,
    accountId: "default",
    dmScope: "per-channel-peer",
  },
  {
    id: "web",
    name: "Web Messaging",
    icon: "compass",
    description: "WebSocket and REST webhooks adapter for custom control integrations.",
    enabled: true,
    configured: true,
    connected: true,
    accountId: "default",
    dmScope: "main",
  },
];

@customElement("coreblow-channels-view")
export class ChannelsView extends LitElement {
  @property({ attribute: false }) app!: CoreBlowApp;

  @state() channels: ChannelEntry[] = [...OFFLINE_CHANNEL_CATALOG];
  @state() loading = false;
  @state() probing = false;
  @state() searchQuery = "";
  @state() expandedChannelId: string | null = null;
  @state() revealedSecrets: Set<string> = new Set();
  @state() editedTokens: Map<string, string> = new Map();
  @state() disconnectConfirmId: string | null = null;
  @state() statusMessage: { success: boolean; text: string } | null = null;
  @state() baseHash: string | undefined = undefined;

  private wasConnected = false;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    void this.loadChannels(false);
  }

  override updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    const isConn = Boolean(this.app?.connected);
    if (isConn !== this.wasConnected) {
      this.wasConnected = isConn;
      if (isConn) {
        void this.loadChannels(false);
      }
    }
  }

  toggleRevealSecret(channelId: string) {
    if (this.revealedSecrets.has(channelId)) {
      this.revealedSecrets.delete(channelId);
    } else {
      this.revealedSecrets.add(channelId);
    }
    this.requestUpdate();
  }

  private resolveChannelIcon(id: string): IconName {
    switch (id) {
      case "telegram":
        return "send";
      case "whatsapp":
        return "messageSquare";
      case "discord":
        return "radio";
      case "slack":
        return "network";
      case "signal":
        return "shield";
      case "web":
        return "compass";
      default:
        return "radio";
    }
  }

  async loadChannels(probe = false) {
    const client = this.app?.gateway?.getClient();
    if (!client?.connected) {
      // Offline mode: keep clean defaults
      this.channels = [...OFFLINE_CHANNEL_CATALOG];
      return;
    }

    if (probe) {
      this.probing = true;
    } else {
      this.loading = true;
    }

    try {
      // 1. Fetch channel status
      const statusRes = await client.request<{
        channelOrder?: string[];
        channelLabels?: Record<string, string>;
        channels?: Record<string, { configured?: boolean; connected?: boolean; running?: boolean }>;
        channelAccounts?: Record<
          string,
          Array<{
            accountId: string;
            configured?: boolean;
            connected?: boolean;
            lastInboundAt?: number | null;
            lastOutboundAt?: number | null;
          }>
        >;
        channelDefaultAccountId?: Record<string, string>;
      }>("channels.status", { probe });

      // 2. Fetch config for enabled state & dmScope
      let configChannels: Record<string, Record<string, unknown>> = {};
      try {
        const configResult = await client.request<{
          config?: { channels?: Record<string, Record<string, unknown>> };
          baseHash?: string;
          hash?: string;
        }>("config.get", {});
        this.baseHash = configResult?.baseHash ?? configResult?.hash;
        if (configResult?.config?.channels) {
          configChannels = configResult.config.channels;
        }
      } catch (err) {
        console.warn("Failed to load channel config:", err);
      }

      const order = statusRes?.channelOrder || OFFLINE_CHANNEL_ORDER;
      const statusMap = statusRes?.channels || {};
      const accountsMap = statusRes?.channelAccounts || {};

      const mapped: ChannelEntry[] = order.map((id: string) => {
        const fallback = OFFLINE_CHANNEL_CATALOG.find((c) => c.id === id);
        const label = statusRes?.channelLabels?.[id] || fallback?.name || id;
        const summary = statusMap[id];
        const accounts = accountsMap[id] || [];
        const firstAccount = accounts[0];
        const cfgEntry = configChannels[id] || {};

        const isConfigured = Boolean(summary?.configured ?? firstAccount?.configured ?? fallback?.configured);
        const isConnected = Boolean(summary?.connected ?? summary?.running ?? firstAccount?.connected ?? fallback?.connected);
        const isEnabled = typeof cfgEntry.enabled === "boolean" ? cfgEntry.enabled : fallback?.enabled ?? true;
        const dmScope = (cfgEntry.dmScope as ChannelEntry["dmScope"]) || fallback?.dmScope || "per-channel-peer";

        return {
          id,
          name: label,
          icon: this.resolveChannelIcon(id),
          description: fallback?.description || `${label} messaging bridge adapter.`,
          enabled: isEnabled,
          configured: isConfigured,
          connected: isConnected,
          accountId: firstAccount?.accountId || "default",
          dmScope,
          botToken: typeof cfgEntry.botToken === "string" ? cfgEntry.botToken : undefined,
          lastInboundAt: firstAccount?.lastInboundAt ?? null,
          lastOutboundAt: firstAccount?.lastOutboundAt ?? null,
        };
      });

      this.channels = mapped;
    } catch (err) {
      console.warn("Failed to load channels from gateway:", err);
      this.channels = [...OFFLINE_CHANNEL_CATALOG];
    } finally {
      this.loading = false;
      this.probing = false;
    }
  }

  private async toggleChannelEnabled(channel: ChannelEntry) {
    const client = this.app?.gateway?.getClient();
    if (!client?.connected) {
      channel.enabled = !channel.enabled;
      this.requestUpdate();
      return;
    }

    const next = !channel.enabled;
    try {
      await client.request("config.patch", {
        raw: JSON.stringify({
          channels: {
            [channel.id]: { enabled: next },
          },
        }),
        baseHash: this.baseHash,
      });
      channel.enabled = next;
      this.statusMessage = {
        success: true,
        text: `${channel.name} ${next ? "enabled" : "disabled"}.`,
      };
      this.requestUpdate();
      void this.loadChannels(false);
    } catch (err) {
      this.statusMessage = {
        success: false,
        text: `Failed to update ${channel.name}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  private async updateDmScope(channel: ChannelEntry, dmScope: ChannelEntry["dmScope"]) {
    const client = this.app?.gateway?.getClient();
    if (!client?.connected) {
      channel.dmScope = dmScope;
      this.requestUpdate();
      return;
    }

    try {
      await client.request("config.patch", {
        raw: JSON.stringify({
          channels: {
            [channel.id]: { dmScope },
          },
        }),
        baseHash: this.baseHash,
      });
      channel.dmScope = dmScope;
      this.statusMessage = {
        success: true,
        text: `${channel.name} dmScope updated to ${dmScope}.`,
      };
      this.requestUpdate();
    } catch (err) {
      this.statusMessage = {
        success: false,
        text: `Failed to update dmScope: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  private async saveBotToken(channel: ChannelEntry) {
    const token = this.editedTokens.get(channel.id);
    if (token === undefined) return;

    const client = this.app?.gateway?.getClient();
    if (!client?.connected) {
      channel.botToken = token;
      this.editedTokens.delete(channel.id);
      this.statusMessage = { success: true, text: `Token stored locally (offline).` };
      this.requestUpdate();
      return;
    }

    try {
      await client.request("config.patch", {
        raw: JSON.stringify({
          channels: {
            [channel.id]: { botToken: token },
          },
        }),
        baseHash: this.baseHash,
      });
      channel.botToken = token;
      this.editedTokens.delete(channel.id);
      this.statusMessage = {
        success: true,
        text: `${channel.name} bot credentials saved.`,
      };
      this.requestUpdate();
      void this.loadChannels(false);
    } catch (err) {
      this.statusMessage = {
        success: false,
        text: `Failed to save token: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  private async logoutChannel(channel: ChannelEntry) {
    const client = this.app?.gateway?.getClient();
    this.disconnectConfirmId = null;

    if (!client?.connected) {
      channel.connected = false;
      channel.configured = false;
      this.statusMessage = { success: true, text: `${channel.name} disconnected (offline).` };
      this.requestUpdate();
      return;
    }

    try {
      await client.request("channels.logout", {
        channel: channel.id,
        accountId: channel.accountId || "default",
      });
      this.statusMessage = {
        success: true,
        text: `${channel.name} account logged out and session cleared.`,
      };
      void this.loadChannels(false);
    } catch (err) {
      this.statusMessage = {
        success: false,
        text: `Logout failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  private formatTimestamp(ts?: number | null): string {
    if (!ts) return "No activity";
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(ts).toLocaleDateString();
  }

  render() {
    const isConnected = Boolean(this.app?.connected);
    const filtered = this.searchQuery
      ? this.channels.filter(
          (c) =>
            c.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
            c.id.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
            c.description.toLowerCase().includes(this.searchQuery.toLowerCase()),
        )
      : this.channels;

    const configuredCount = this.channels.filter((c) => c.configured).length;
    const activeCount = this.channels.filter((c) => c.enabled && c.connected).length;

    return html`
      <div
        class="cb-channels-root"
        style="padding: 24px 32px; max-width: 1200px; margin: 0 auto; color: var(--text);"
      >
        <!-- Header Bar -->
        <div
          style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; flex-wrap: wrap;"
        >
          <div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span
                style="font-size: 20px; font-weight: 700; color: var(--text-strong); letter-spacing: -0.02em;"
              >
                Channels
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
                ${isConnected
                  ? `${activeCount} active · ${configuredCount} configured`
                  : "Offline Defaults · Loopback Disconnected"}
              </span>
            </div>
            <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">
              CoreBlow Messaging Bridges · Multi-Platform Adapters &amp; Routing
            </div>
          </div>

          <!-- Actions -->
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <!-- Search -->
            <div style="position: relative; width: 220px;">
              <input
                type="text"
                placeholder="Search channels..."
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

            <!-- Probe Channels Button -->
            <button
              type="button"
              style="display: flex; align-items: center; gap: 6px; background: var(--card); border: 1px solid var(--border-hairline); padding: 6px 12px; border-radius: var(--radius-sm); color: var(--text-strong); font-size: 11px; font-weight: 500; cursor: pointer;"
              title="Perform live probe check on all channels"
              ?disabled=${this.probing || !isConnected}
              @click=${() => void this.loadChannels(true)}
            >
              <span style="width: 13px; height: 13px; color: var(--accent);">${renderIcon("radio")}</span>
              ${this.probing ? "Probing..." : "Probe Channels"}
            </button>

            <!-- Refresh Button -->
            <button
              type="button"
              style="display: flex; align-items: center; gap: 6px; background: var(--card); border: 1px solid var(--border-hairline); padding: 6px 12px; border-radius: var(--radius-sm); color: var(--text-strong); font-size: 11px; font-weight: 500; cursor: pointer;"
              title="Reload channel statuses from gateway"
              @click=${() => void this.loadChannels(false)}
            >
              <span style="width: 13px; height: 13px;">${renderIcon("refresh")}</span>
              ${this.loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        <!-- Notification Banner -->
        ${this.statusMessage
          ? html`
              <div
                style="padding: 10px 14px; border-radius: var(--radius-sm); margin-bottom: 16px; font-size: 12px; display: flex; align-items: center; justify-content: space-between; background: ${this.statusMessage.success
                  ? "var(--surface-flat-hover)"
                  : "rgba(239, 68, 68, 0.1)"}; border: 1px solid ${this.statusMessage.success
                  ? "var(--accent)"
                  : "rgba(239, 68, 68, 0.3)"}; color: ${this.statusMessage.success
                  ? "var(--accent)"
                  : "var(--danger, #f87171)"};"
              >
                <span>${this.statusMessage.text}</span>
                <button
                  type="button"
                  style="background: transparent; border: none; color: inherit; cursor: pointer;"
                  @click=${() => (this.statusMessage = null)}
                >
                  ✕
                </button>
              </div>
            `
          : ""}

        <!-- Channel Cards Grid -->
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${filtered.length === 0
            ? html`
                <div
                  style="padding: 32px; text-align: center; background: var(--card); border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); color: var(--muted); font-size: 13px;"
                >
                  No channels matched "${this.searchQuery}".
                </div>
              `
            : filtered.map((ch) => {
                const isExpanded = this.expandedChannelId === ch.id;
                const isRevealed = this.revealedSecrets.has(ch.id);
                const currentToken =
                  this.editedTokens.has(ch.id)
                    ? this.editedTokens.get(ch.id)!
                    : ch.botToken || "";

                return html`
                  <div
                    class="cb-channel-card"
                    style="background: var(--card); border: 1px solid ${ch.enabled
                      ? "var(--border-hairline)"
                      : "var(--border-subtle)"}; border-radius: var(--radius-sm); overflow: hidden; transition: border-color 0.15s ease;"
                  >
                    <!-- Main Row -->
                    <div
                      style="display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; gap: 16px; flex-wrap: wrap;"
                    >
                      <!-- Left: Icon + Label + Subtitle -->
                      <div style="display: flex; align-items: center; gap: 12px; min-width: 240px; flex: 1;">
                        <span
                          style="width: 32px; height: 32px; border-radius: var(--radius-sm); background: var(--surface-flat-muted); border: 1px solid var(--border-subtle); display: inline-flex; align-items: center; justify-content: center; color: ${ch.enabled
                            ? "var(--accent)"
                            : "var(--muted)"}; flex-shrink: 0;"
                        >
                          ${renderIcon(ch.icon)}
                        </span>
                        <div>
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 14px; font-weight: 600; color: var(--text-strong);">
                              ${ch.name}
                            </span>
                            <span style="font-size: 11px; font-family: var(--mono); color: var(--muted);">
                              channels.${ch.id}
                            </span>
                          </div>
                          <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">
                            ${ch.description}
                          </div>
                        </div>
                      </div>

                      <!-- Middle: Activity & Account -->
                      <div style="display: flex; align-items: center; gap: 20px; font-size: 11px; font-family: var(--mono); color: var(--muted);">
                        <div>
                          <span style="color: var(--text-strong); opacity: 0.7;">Inbound:</span>
                          ${this.formatTimestamp(ch.lastInboundAt)}
                        </div>
                        <div>
                          <span style="color: var(--text-strong); opacity: 0.7;">Outbound:</span>
                          ${this.formatTimestamp(ch.lastOutboundAt)}
                        </div>
                      </div>

                      <!-- Right: Status Pill + Enable Toggle + Expand Button -->
                      <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
                        <!-- Status Pill -->
                        <span
                          style="font-size: 11px; font-family: var(--mono); padding: 3px 8px; border-radius: 10px; font-weight: 500; background: ${ch.connected
                            ? "rgba(20, 184, 166, 0.12)"
                            : ch.configured
                              ? "rgba(234, 179, 8, 0.12)"
                              : "var(--surface-flat-muted)"}; color: ${ch.connected
                            ? "var(--accent)"
                            : ch.configured
                              ? "#eab308"
                              : "var(--muted)"}; border: 1px solid ${ch.connected
                            ? "rgba(20, 184, 166, 0.25)"
                            : ch.configured
                              ? "rgba(234, 179, 8, 0.25)"
                              : "var(--border-subtle)"};"
                        >
                          ${ch.connected ? "Connected" : ch.configured ? "Configured" : ch.enabled ? "Ready" : "Disabled"}
                        </span>

                        <!-- Enabled Toggle -->
                        <button
                          type="button"
                          role="switch"
                          aria-checked="${ch.enabled}"
                          style="width: 36px; height: 20px; border-radius: 10px; background: ${ch.enabled
                            ? "var(--accent)"
                            : "var(--bg-muted)"}; border: 1px solid ${ch.enabled
                            ? "var(--accent)"
                            : "var(--border-hairline)"}; cursor: pointer; position: relative; padding: 0; outline: none; transition: background 0.2s ease;"
                          title="${ch.enabled ? "Disable channel" : "Enable channel"}"
                          @click=${() => this.toggleChannelEnabled(ch)}
                        >
                          <span
                            style="display: block; width: 14px; height: 14px; border-radius: 50%; background: ${ch.enabled
                              ? "var(--primary-foreground)"
                              : "var(--muted)"}; position: absolute; top: 2px; left: ${ch.enabled
                              ? "18px"
                              : "2px"}; transition: left 0.2s ease;"
                          ></span>
                        </button>

                        <!-- Expand Config Drawer -->
                        <button
                          type="button"
                          style="background: transparent; border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); padding: 5px 10px; color: var(--text); font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px;"
                          @click=${() => {
                            this.expandedChannelId = isExpanded ? null : ch.id;
                          }}
                        >
                          <span>${isExpanded ? "Close" : "Configure"}</span>
                          <span style="font-size: 9px; color: var(--muted);">${isExpanded ? "▲" : "▼"}</span>
                        </button>
                      </div>
                    </div>

                    <!-- Expandable Quick-Config Panel -->
                    ${isExpanded
                      ? html`
                          <div
                            style="padding: 16px 18px; border-top: 1px solid var(--border-hairline); background: var(--surface-flat-muted); display: flex; flex-direction: column; gap: 14px;"
                          >
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
                              <!-- dmScope Selector -->
                              <div>
                                <label style="display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-strong); margin-bottom: 6px;">
                                  DM Session Scope
                                </label>
                                <select
                                  style="width: 100%; background: var(--card); border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); color: var(--text-strong); padding: 7px 10px; font-size: 12px; font-family: var(--mono); outline: none;"
                                  @change=${(e: Event) =>
                                    this.updateDmScope(
                                      ch,
                                      (e.target as HTMLSelectElement).value as ChannelEntry["dmScope"],
                                    )}
                                >
                                  <option value="per-channel-peer" ?selected=${ch.dmScope === "per-channel-peer"}>
                                    per-channel-peer (isolated per platform)
                                  </option>
                                  <option value="per-peer" ?selected=${ch.dmScope === "per-peer"}>
                                    per-peer (shared across instances)
                                  </option>
                                  <option value="main" ?selected=${ch.dmScope === "main"}>
                                    main (single shared root session)
                                  </option>
                                </select>
                                <div style="font-size: 11px; color: var(--muted); margin-top: 4px;">
                                  Controls session boundary isolation for direct messages.
                                </div>
                              </div>

                              <!-- Bot Token / Secret Credential -->
                              <div>
                                <label style="display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-strong); margin-bottom: 6px;">
                                  Bot Token / API Secret
                                </label>
                                <div style="display: flex; gap: 8px;">
                                  <div style="position: relative; flex: 1;">
                                    <input
                                      type=${isRevealed ? "text" : "password"}
                                      placeholder="••••••••••••••••"
                                      style="width: 100%; background: var(--card); border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); color: var(--text-strong); padding: 7px 32px 7px 10px; font-size: 12px; font-family: var(--mono); outline: none;"
                                      .value=${currentToken}
                                      @input=${(e: Event) => {
                                        this.editedTokens.set(ch.id, (e.target as HTMLInputElement).value);
                                        this.requestUpdate();
                                      }}
                                    />
                                    <button
                                      type="button"
                                      style="position: absolute; right: 6px; top: 6px; width: 20px; height: 20px; background: transparent; border: none; color: var(--muted); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;"
                                      title="${isRevealed ? "Hide token" : "Reveal token"}"
                                      @click=${() => this.toggleRevealSecret(ch.id)}
                                    >
                                      ${renderIcon(isRevealed ? "eyeOff" : "eye")}
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    style="background: var(--surface-flat-hover); border: 1px solid var(--border-hairline); color: var(--accent); padding: 6px 14px; border-radius: var(--radius-sm); font-size: 11px; font-weight: 600; cursor: pointer; white-space: nowrap;"
                                    ?disabled=${!this.editedTokens.has(ch.id)}
                                    @click=${() => this.saveBotToken(ch)}
                                  >
                                    Save
                                  </button>
                                </div>
                                <div style="font-size: 11px; color: var(--muted); margin-top: 4px;">
                                  Credentials are encrypted and masked at rest.
                                </div>
                              </div>
                            </div>

                            <!-- Footer actions: Logout/Disconnect -->
                            <div
                              style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border-subtle); padding-top: 12px; margin-top: 4px;"
                            >
                              <div style="font-size: 11px; color: var(--muted);">
                                Account ID: <code style="font-family: var(--mono); color: var(--text-strong);">${ch.accountId}</code>
                              </div>

                              <div>
                                ${this.disconnectConfirmId === ch.id
                                  ? html`
                                      <div style="display: flex; align-items: center; gap: 8px;">
                                        <span style="font-size: 11px; color: var(--danger, #f87171);">Disconnect account session?</span>
                                        <button
                                          type="button"
                                          style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); color: var(--danger, #f87171); padding: 4px 10px; border-radius: var(--radius-sm); font-size: 11px; font-weight: 600; cursor: pointer;"
                                          @click=${() => this.logoutChannel(ch)}
                                        >
                                          Confirm Logout
                                        </button>
                                        <button
                                          type="button"
                                          style="background: transparent; border: 1px solid var(--border-hairline); padding: 4px 8px; border-radius: var(--radius-sm); font-size: 11px; color: var(--muted); cursor: pointer;"
                                          @click=${() => (this.disconnectConfirmId = null)}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    `
                                  : html`
                                      <button
                                        type="button"
                                        style="background: transparent; border: 1px solid var(--border-hairline); color: var(--muted); padding: 5px 12px; border-radius: var(--radius-sm); font-size: 11px; cursor: pointer;"
                                        @click=${() => (this.disconnectConfirmId = ch.id)}
                                      >
                                        Disconnect / Clear Session
                                      </button>
                                    `}
                              </div>
                            </div>
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

const OFFLINE_CHANNEL_ORDER = ["telegram", "whatsapp", "discord", "slack", "signal", "web"];
