import React, { useState, useEffect } from "react";
import { gatewayClient } from "../services/gateway-client";
import type { CoreHubSkill, PermissionMode, CredentialPoolPayload } from "../types/gateway";
import type { UiPreferences } from "../services/storage";
import {
  CloseIcon,
  CoreBlowEmblem,
  FolderIcon,
  RefreshIcon,
  SettingsIcon,
  ShieldIcon,
  SparklesIcon,
  TerminalIcon,
} from "./Icons";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  preferences: UiPreferences;
  onUpdatePreferences: (prefs: Partial<UiPreferences>) => void;
}

type SettingsSection =
  | "general"
  | "models"
  | "channels"
  | "remotes"
  | "automations"
  | "permissions"
  | "skills"
  | "about";

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  preferences,
  onUpdatePreferences,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");
  const [skills, setSkills] = useState<CoreHubSkill[]>([]);
  const [learnedSkills, setLearnedSkills] = useState<CoreHubSkill[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);

  const [poolData, setPoolData] = useState<CredentialPoolPayload | null>(null);
  const [loadingPool, setLoadingPool] = useState(false);
  const [newKeyProvider, setNewKeyProvider] = useState("anthropic");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [newKeyLabel, setNewKeyLabel] = useState("");

  const fetchPools = async () => {
    setLoadingPool(true);
    try {
      const data = await gatewayClient.getCredentialPools();
      if (data) setPoolData(data);
    } finally {
      setLoadingPool(false);
    }
  };

  useEffect(() => {
    if (open && activeSection === "skills") {
      setLoadingSkills(true);
      Promise.all([gatewayClient.getStorefront(), gatewayClient.getLearnedSkills()])
        .then(([storefront, learned]) => {
          setSkills(storefront);
          setLearnedSkills(learned);
        })
        .finally(() => setLoadingSkills(false));
    }
    if (open && activeSection === "models") {
      fetchPools();
    }
  }, [open, activeSection]);

  const handleAddPoolKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyValue.trim()) return;
    const ok = await gatewayClient.addCredentialPoolKey({
      providerId: newKeyProvider,
      apiKey: newKeyValue.trim(),
      label: newKeyLabel.trim() || undefined,
    });
    if (ok) {
      setNewKeyValue("");
      setNewKeyLabel("");
      await fetchPools();
    }
  };

  const handleDeletePoolKey = async (keyId: string) => {
    const ok = await gatewayClient.deleteCredentialPoolKey(keyId);
    if (ok) {
      await fetchPools();
    }
  };

  const handleMoveFallback = async (index: number, direction: -1 | 1) => {
    if (!poolData) return;
    const chain = [...poolData.fallbackChain];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= chain.length) return;
    const temp = chain[index];
    chain[index] = chain[targetIdx];
    chain[targetIdx] = temp;
    await gatewayClient.saveFallbackChain(chain);
    await fetchPools();
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.55)",
        backdropFilter: "blur(12px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "800px",
          height: "min(800px, calc(100vh - 48px))",
          maxWidth: "calc(100vw - 48px)",
          background: "var(--bg-card)",
          border: "1px solid var(--border-medium)",
          borderRadius: "var(--radius-panel)",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.6)",
          display: "grid",
          gridTemplateColumns: "188px 1fr",
          gridTemplateRows: "54px 1fr",
          overflow: "hidden",
        }}
      >
        {/* Left Nav Header */}
        <div
          style={{
            borderBottom: "1px solid var(--border-subtle)",
            borderRight: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--ink-primary)",
          }}
        >
          Settings
        </div>

        {/* Right Content Header */}
        <div
          style={{
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
          }}
        >
          <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink-primary)", textTransform: "capitalize" }}>
            {activeSection === "models" ? "API Keys & Models" : activeSection === "remotes" ? "Remote Nodes" : activeSection === "automations" ? "Automations & Cron" : activeSection}
          </span>
          <button
            type="button"
            onClick={onClose}
            title="Close Settings (Esc)"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--ink-muted)",
              cursor: "pointer",
              padding: "4px",
              display: "grid",
              placeItems: "center",
              borderRadius: "var(--radius-xs)",
            }}
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Left Nav Column */}
        <nav
          style={{
            borderRight: "1px solid var(--border-subtle)",
            padding: "10px 8px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            background: "rgba(0, 0, 0, 0.15)",
          }}
        >
          {[
            { id: "general", label: "General", icon: <SettingsIcon size={14} /> },
            { id: "models", label: "API Keys & Models", icon: <SparklesIcon size={14} /> },
            { id: "channels", label: "Channels", icon: <TerminalIcon size={14} /> },
            { id: "remotes", label: "Remote Nodes", icon: <FolderIcon size={14} /> },
            { id: "automations", label: "Automations & Cron", icon: <RefreshIcon size={14} /> },
            { id: "permissions", label: "Permissions", icon: <ShieldIcon size={14} /> },
            { id: "skills", label: "Skills", icon: <SparklesIcon size={14} /> },
            { id: "about", label: "About", icon: <CoreBlowEmblem size={14} /> },
          ].map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id as SettingsSection)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  height: "36px",
                  padding: "0 10px",
                  borderRadius: "var(--radius-sm)",
                  background: isActive ? "var(--bg-chip)" : "transparent",
                  border: isActive ? "1px solid var(--border-medium)" : "1px solid transparent",
                  color: isActive ? "var(--ink-primary)" : "var(--ink-secondary)",
                  fontSize: "13px",
                  fontWeight: isActive ? 500 : 400,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.12s ease",
                }}
              >
                <span style={{ color: isActive ? "var(--accent-teal)" : "var(--ink-muted)" }}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Content Options */}
        <div style={{ padding: "20px", overflowY: "auto" }}>
          {activeSection === "general" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <h4 style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink-primary)", marginBottom: "4px" }}>
                  Appearance & Theme
                </h4>
                <p style={{ fontSize: "12px", color: "var(--ink-secondary)", marginBottom: "12px" }}>
                  CoreBlow Studio uses the Quiet Instrument design system with dark OLED canvas.
                </p>
                <div style={{ display: "flex", gap: "10px" }}>
                  <div
                    style={{
                      padding: "8px 16px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--accent-teal)",
                      background: "var(--bg-chip)",
                      color: "var(--accent-teal)",
                      fontSize: "12px",
                      fontWeight: 500,
                    }}
                  >
                    Quiet Instrument (#08110F)
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink-primary)", marginBottom: "4px" }}>
                  Gateway Connection
                </h4>
                <p style={{ fontSize: "12px", color: "var(--ink-secondary)", marginBottom: "8px" }}>
                  Single-Brain Daemon URL:
                </p>
                <input
                  type="text"
                  readOnly
                  value="http://127.0.0.1:18789"
                  style={{
                    width: "320px",
                    height: "32px",
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-xs)",
                    padding: "0 10px",
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    color: "var(--accent-teal)",
                    outline: "none",
                  }}
                />
              </div>
            </div>
          )}

          {activeSection === "models" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* 1. Live Usage Telemetry Strip */}
              {(() => {
                const todayKey = new Date().toISOString().slice(0, 10);
                const daily = poolData?.telemetry?.daily?.[todayKey] ?? {
                  requests: 0,
                  totalTokens: 0,
                  failovers: 0,
                  estimatedCostUsd: 0,
                };
                return (
                  <div
                    style={{
                      background: "var(--bg-card)",
                      borderRadius: "var(--radius-sm)",
                      padding: "10px 12px",
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase" }}>
                      Live Usage Telemetry (Today)
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", textAlign: "center" }}>
                      <div style={{ background: "var(--bg-code)", padding: "6px", borderRadius: "var(--radius-xs)" }}>
                        <div style={{ fontSize: "10px", color: "var(--ink-muted)" }}>Requests</div>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink-primary)" }}>{daily.requests}</div>
                      </div>
                      <div style={{ background: "var(--bg-code)", padding: "6px", borderRadius: "var(--radius-xs)" }}>
                        <div style={{ fontSize: "10px", color: "var(--ink-muted)" }}>Total Tokens</div>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--accent-teal)" }}>
                          {daily.totalTokens > 1000 ? `${(daily.totalTokens / 1000).toFixed(1)}k` : daily.totalTokens}
                        </div>
                      </div>
                      <div style={{ background: "var(--bg-code)", padding: "6px", borderRadius: "var(--radius-xs)" }}>
                        <div style={{ fontSize: "10px", color: "var(--ink-muted)" }}>Failovers</div>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: daily.failovers > 0 ? "#f59e0b" : "var(--ink-secondary)" }}>
                          {daily.failovers}
                        </div>
                      </div>
                      <div style={{ background: "var(--bg-code)", padding: "6px", borderRadius: "var(--radius-xs)" }}>
                        <div style={{ fontSize: "10px", color: "var(--ink-muted)" }}>Est. Cost</div>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--state-success, #10b981)" }}>
                          ${daily.estimatedCostUsd.toFixed(4)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 2. Automatic Fallback Chain */}
              <div
                style={{
                  background: "var(--bg-card)",
                  borderRadius: "var(--radius-sm)",
                  padding: "10px 12px",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase" }}>
                  Daybreak Provider Fallback Chain
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  {(poolData?.fallbackChain ?? ["anthropic", "openai", "gemini", "groq", "deepseek", "ollama"]).map((prov, idx, arr) => (
                    <div
                      key={prov}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        background: "var(--bg-code)",
                        padding: "3px 6px",
                        borderRadius: "var(--radius-xs)",
                        border: "1px solid var(--border-subtle)",
                        fontSize: "11px",
                      }}
                    >
                      <span style={{ fontWeight: 600, color: "var(--ink-primary)" }}>{prov}</span>
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => handleMoveFallback(idx, -1)}
                          style={{ background: "transparent", border: "none", color: "var(--ink-muted)", cursor: "pointer", padding: "0 2px" }}
                          title="Move left"
                        >
                          ‹
                        </button>
                      )}
                      {idx < arr.length - 1 && (
                        <button
                          type="button"
                          onClick={() => handleMoveFallback(idx, 1)}
                          style={{ background: "transparent", border: "none", color: "var(--ink-muted)", cursor: "pointer", padding: "0 2px" }}
                          title="Move right"
                        >
                          ›
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Multi-Key Credential Pools */}
              <div
                style={{
                  background: "var(--bg-card)",
                  borderRadius: "var(--radius-sm)",
                  padding: "10px 12px",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase" }}>
                  Multi-Key Credential Pools
                </div>

                {/* Add Key Form */}
                <form onSubmit={handleAddPoolKey} style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <select
                    value={newKeyProvider}
                    onChange={(e) => setNewKeyProvider(e.target.value)}
                    style={{
                      height: "30px",
                      background: "var(--bg-code)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-xs)",
                      color: "var(--ink-primary)",
                      fontSize: "11px",
                      padding: "0 6px",
                    }}
                  >
                    <option value="anthropic">Anthropic</option>
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Gemini</option>
                    <option value="groq">Groq</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="custom">Custom</option>
                  </select>
                  <input
                    type="password"
                    placeholder="API Key (e.g. sk-ant-...)"
                    value={newKeyValue}
                    onChange={(e) => setNewKeyValue(e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: "160px",
                      height: "30px",
                      background: "var(--bg-code)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-xs)",
                      color: "var(--ink-primary)",
                      fontSize: "11px",
                      padding: "0 8px",
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Label (optional)"
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                    style={{
                      width: "120px",
                      height: "30px",
                      background: "var(--bg-code)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-xs)",
                      color: "var(--ink-primary)",
                      fontSize: "11px",
                      padding: "0 8px",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!newKeyValue.trim()}
                    style={{
                      height: "30px",
                      padding: "0 10px",
                      background: "var(--accent-teal)",
                      color: "#000",
                      border: "none",
                      borderRadius: "var(--radius-xs)",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: newKeyValue.trim() ? "pointer" : "default",
                      opacity: newKeyValue.trim() ? 1 : 0.5,
                    }}
                  >
                    + Add Key
                  </button>
                </form>

                {/* Pooled Keys List */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {(!poolData?.pools || Object.keys(poolData.pools).length === 0) ? (
                    <div style={{ fontSize: "11px", color: "var(--ink-muted)", fontStyle: "italic" }}>
                      No pooled keys added yet. Add multiple keys per provider for automatic failover on 429 rate limits.
                    </div>
                  ) : (
                    Object.entries(poolData.pools).flatMap(([prov, keys]) =>
                      keys.map((k) => {
                        const inCooldown = Boolean(k.cooldownUntilMs && k.cooldownUntilMs > Date.now());
                        return (
                          <div
                            key={k.id}
                            style={{
                              background: "var(--bg-code)",
                              padding: "6px 10px",
                              borderRadius: "var(--radius-xs)",
                              border: "1px solid var(--border-subtle)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              fontSize: "11px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontWeight: 700, color: "var(--ink-primary)" }}>[{prov}]</span>
                              <span>{k.label}</span>
                              <code style={{ color: "var(--ink-muted)", fontSize: "10px" }}>{k.apiKey}</code>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span
                                style={{
                                  padding: "1px 6px",
                                  borderRadius: "3px",
                                  fontSize: "9px",
                                  fontWeight: 600,
                                  background: inCooldown ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)",
                                  color: inCooldown ? "#f59e0b" : "var(--state-success, #10b981)",
                                }}
                              >
                                {inCooldown ? "Cooldown" : "Healthy"}
                              </span>
                              <span style={{ color: "var(--ink-muted)", fontSize: "10px" }}>
                                {k.totalTokens > 0 ? `${(k.totalTokens / 1000).toFixed(1)}k tok` : "0 tok"}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeletePoolKey(k.id)}
                                title="Remove key"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "var(--ink-muted)",
                                  cursor: "pointer",
                                  fontSize: "13px",
                                  lineHeight: 1,
                                }}
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        );
                      }),
                    )
                  )}
                </div>
              </div>

              {/* 4. Direct Single-Key Vault Preferences */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink-muted)", textTransform: "uppercase" }}>
                  Direct Vault Overrides
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 500, color: "var(--ink-primary)", marginBottom: "3px" }}>
                    Anthropic API Key (Claude)
                  </label>
                  <input
                    type="password"
                    value={preferences.anthropicApiKey || ""}
                    onChange={(e) => onUpdatePreferences({ anthropicApiKey: e.target.value })}
                    placeholder="sk-ant-api03-..."
                    style={{
                      width: "100%",
                      height: "30px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-xs)",
                      padding: "0 10px",
                      color: "var(--ink-primary)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 500, color: "var(--ink-primary)", marginBottom: "3px" }}>
                    OpenAI API Key (GPT-4o / o1 / o3)
                  </label>
                  <input
                    type="password"
                    value={preferences.openAiApiKey || ""}
                    onChange={(e) => onUpdatePreferences({ openAiApiKey: e.target.value })}
                    placeholder="sk-proj-..."
                    style={{
                      width: "100%",
                      height: "30px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-xs)",
                      padding: "0 10px",
                      color: "var(--ink-primary)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 500, color: "var(--ink-primary)", marginBottom: "3px" }}>
                    Google Gemini API Key
                  </label>
                  <input
                    type="password"
                    value={preferences.geminiApiKey || ""}
                    onChange={(e) => onUpdatePreferences({ geminiApiKey: e.target.value })}
                    placeholder="AIzaSy..."
                    style={{
                      width: "100%",
                      height: "30px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-xs)",
                      padding: "0 10px",
                      color: "var(--ink-primary)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 500, color: "var(--ink-primary)", marginBottom: "3px" }}>
                    Groq API Key (Llama 3.3 / Ultra-Fast)
                  </label>
                  <input
                    type="password"
                    value={preferences.groqApiKey || ""}
                    onChange={(e) => onUpdatePreferences({ groqApiKey: e.target.value })}
                    placeholder="gsk_..."
                    style={{
                      width: "100%",
                      height: "30px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-xs)",
                      padding: "0 10px",
                      color: "var(--ink-primary)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 500, color: "var(--ink-primary)", marginBottom: "3px" }}>
                    Local Ollama Endpoint URL
                  </label>
                  <input
                    type="text"
                    value={preferences.localOllamaUrl || "http://127.0.0.1:11434"}
                    onChange={(e) => onUpdatePreferences({ localOllamaUrl: e.target.value })}
                    placeholder="http://127.0.0.1:11434"
                    style={{
                      width: "100%",
                      height: "30px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-xs)",
                      padding: "0 10px",
                      color: "var(--ink-primary)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      outline: "none",
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === "channels" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <p style={{ fontSize: "12px", color: "var(--ink-secondary)" }}>
                CoreBlow Unified Channels integration managed by the Gateway.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {["Telegram", "Discord", "Slack", "WhatsApp (Web)", "Signal", "iMessage"].map((ch) => (
                  <div
                    key={ch}
                    style={{
                      padding: "10px",
                      background: "var(--bg-input)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-subtle)",
                      fontSize: "12px",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{ch}</span>
                    <span style={{ color: "var(--ink-muted)", fontSize: "11px" }}>Configurable</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === "remotes" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <p style={{ fontSize: "12px", color: "var(--ink-secondary)", lineHeight: 1.5 }}>
                Manage remote gateway pairing and headless nodes across Tailscale or SSH tunnels.
              </p>

              {/* Primary Local Node */}
              <div
                style={{
                  background: "var(--bg-input)",
                  borderRadius: "var(--radius-md)",
                  padding: "12px 14px",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "var(--state-success)",
                        boxShadow: "0 0 6px var(--state-success)",
                      }}
                    />
                    <strong style={{ fontSize: "13px", color: "var(--ink-primary)" }}>Local Node (Single-Brain)</strong>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--ink-secondary)", marginTop: "2px", fontFamily: "var(--font-mono)" }}>
                    http://127.0.0.1:18789
                  </div>
                </div>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: "var(--radius-xs)",
                    background: "rgba(16, 185, 129, 0.1)",
                    color: "var(--state-success)",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  Active
                </span>
              </div>

              {/* Remote Node Connection Settings */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--ink-primary)", marginBottom: "4px" }}>
                    Remote Gateway Host (SSH / Tailscale URL)
                  </label>
                  <input
                    type="text"
                    value={preferences.remoteHost || ""}
                    onChange={(e) => onUpdatePreferences({ remoteHost: e.target.value })}
                    placeholder="https://studio-gateway.tailnet.ts.net:18789"
                    style={{
                      width: "100%",
                      height: "34px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-xs)",
                      padding: "0 10px",
                      color: "var(--ink-primary)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "12px",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "var(--ink-primary)", marginBottom: "4px" }}>
                    Remote Auth Token
                  </label>
                  <input
                    type="password"
                    value={preferences.remoteToken || ""}
                    onChange={(e) => onUpdatePreferences({ remoteToken: e.target.value })}
                    placeholder="Enter pairing token..."
                    style={{
                      width: "100%",
                      height: "34px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-xs)",
                      padding: "0 10px",
                      color: "var(--ink-primary)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "12px",
                      outline: "none",
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === "automations" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <p style={{ fontSize: "12px", color: "var(--ink-secondary)", lineHeight: 1.5 }}>
                Configure autonomous background cron daemons and self-healing tasks executed by the Gateway.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  {
                    key: "repoHealth" as const,
                    title: "Daily Repository Health Check",
                    desc: "Runs automated lint, format, and 5-gate audit checks on workspace checkout.",
                  },
                  {
                    key: "memoryCompaction" as const,
                    title: "Cory Memory Compaction",
                    desc: "Consolidates episodic turns into canonical durable semantic knowledge layers.",
                  },
                  {
                    key: "evoloopDistillation" as const,
                    title: "EvoLoop Skill Distillation",
                    desc: "Analyzes successful multi-turn tool trajectories to synthesize learned skills.",
                  },
                  {
                    key: "logPruning" as const,
                    title: "Weekly Log Pruning",
                    desc: "Prunes legacy session logs and temporary artifacts older than 14 days.",
                  },
                ].map((item) => {
                  const isChecked = preferences.automations[item.key];
                  return (
                    <label
                      key={item.key}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "12px",
                        padding: "12px 14px",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--bg-input)",
                        border: "1px solid var(--border-subtle)",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) =>
                          onUpdatePreferences({
                            automations: {
                              ...preferences.automations,
                              [item.key]: e.target.checked,
                            },
                          })
                        }
                        style={{ accentColor: "var(--accent-teal)", marginTop: "2px" }}
                      />
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-primary)" }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--ink-secondary)", marginTop: "2px" }}>
                          {item.desc}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {activeSection === "permissions" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <h4 style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink-primary)", marginBottom: "4px" }}>
                  Default Execution Boundary
                </h4>
                <p style={{ fontSize: "12px", color: "var(--ink-secondary)", marginBottom: "12px" }}>
                  Choose the default security sandbox profile for autonomous ReAct turns:
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {(["Full access", "Workspace", "Guarded", "Read-only"] as PermissionMode[]).map((mode) => (
                    <label
                      key={mode}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "8px 12px",
                        borderRadius: "var(--radius-sm)",
                        background: preferences.permissionMode === mode ? "var(--bg-chip)" : "var(--bg-input)",
                        border: preferences.permissionMode === mode ? "1px solid var(--accent-teal)" : "1px solid var(--border-subtle)",
                        cursor: "pointer",
                        fontSize: "13px",
                      }}
                    >
                      <input
                        type="radio"
                        name="perm-mode"
                        checked={preferences.permissionMode === mode}
                        onChange={() => onUpdatePreferences({ permissionMode: mode })}
                        style={{ accentColor: "var(--accent-teal)" }}
                      />
                      <span style={{ fontWeight: 500, color: "var(--ink-primary)" }}>{mode}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === "skills" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-primary)" }}>
                  CoreHub Skill Storefront & Learned Skills
                </span>
                {loadingSkills && <span className="animate-spin" style={{ color: "var(--accent-teal)" }}>●</span>}
              </div>

              {skills.length > 0 || learnedSkills.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[...learnedSkills, ...skills].map((skill, idx) => (
                    <div
                      key={`${skill.id}-${idx}`}
                      style={{
                        background: "var(--bg-input)",
                        borderRadius: "var(--radius-sm)",
                        padding: "10px",
                        border: "1px solid var(--border-subtle)",
                        fontSize: "12px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 600, color: "var(--accent-teal)" }}>{skill.name}</span>
                        {skill.category && (
                          <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "var(--radius-xs)", background: "var(--bg-chip)", color: "var(--ink-muted)" }}>
                            {skill.category}
                          </span>
                        )}
                      </div>
                      <div style={{ color: "var(--ink-secondary)", marginTop: "2px" }}>{skill.description}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: "12px", color: "var(--ink-muted)", fontStyle: "italic" }}>
                  Connected to Gateway skill registry at /api/corehub/storefront
                </div>
              )}
            </div>
          )}

          {activeSection === "about" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "center", textAlign: "center", paddingTop: "20px" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "var(--radius-md)",
                  background: "var(--bg-chip)",
                  border: "1px solid var(--border-medium)",
                  display: "grid",
                  placeItems: "center",
                  color: "var(--accent-teal)",
                }}
              >
                <CoreBlowEmblem size={32} />
              </div>

              <div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--ink-primary)", letterSpacing: "0.04em" }}>
                  CoreBlow Studio
                </h3>
                <div style={{ fontSize: "12px", color: "var(--accent-teal)", fontWeight: 600, marginTop: "2px" }}>
                  Version 2.0.0 (Release)
                </div>
                <div style={{ fontSize: "11px", color: "var(--ink-muted)", marginTop: "4px" }}>
                  Application ID: ai.coreblow.studio
                </div>
              </div>

              <div
                style={{
                  maxWidth: "420px",
                  fontSize: "12px",
                  color: "var(--ink-secondary)",
                  lineHeight: 1.6,
                }}
              >
                Next-generation Electron desktop shell wired to the Single-Brain Gateway daemon (:18789).
                Crafted with Quiet Instrument design tokens for zero-distraction AI engineering.
              </div>

              <div style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
                © 2026 CoreBlow Team. All rights reserved.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
