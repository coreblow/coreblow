import React, { useState } from "react";
import { CoreBlowEmblem, CheckIcon, ShieldIcon, TerminalIcon, SparklesIcon } from "./Icons";
import { gatewayClient } from "../services/gateway-client";

export interface GettingStartedFlowProps {
  userName?: string;
  onUpdateUserName: (name: string) => void;
  accentColor: string;
  onUpdateAccentColor: (color: string) => void;
  themeMode: "dark" | "light";
  onUpdateThemeMode: (mode: "dark" | "light") => void;
  layoutMode: "basic" | "pro";
  onUpdateLayoutMode: (mode: "basic" | "pro") => void;
  onSaveApiKey: (provider: "anthropic" | "openai" | "gemini" | "groq", key: string) => void;
  onFinish: () => void;
  onSkip: () => void;
}

const ACCENT_SWATCHES = [
  { name: "Teal", color: "#2DD4BF" },
  { name: "Emerald", color: "#10B981" },
  { name: "Sky", color: "#38BDF8" },
  { name: "Electric Blue", color: "#3B82F6" },
  { name: "Violet", color: "#8B5CF6" },
  { name: "Rose", color: "#EC4899" },
  { name: "Amber", color: "#F59E0B" },
  { name: "Safety Orange", color: "#F97316" },
];

export const GettingStartedFlow: React.FC<GettingStartedFlowProps> = ({
  userName = "",
  onUpdateUserName,
  accentColor,
  onUpdateAccentColor,
  themeMode,
  onUpdateThemeMode,
  layoutMode,
  onUpdateLayoutMode,
  onSaveApiKey,
  onFinish,
  onSkip,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [nameInput, setNameInput] = useState(userName);
  const [selectedProvider, setSelectedProvider] = useState<"anthropic" | "openai" | "gemini" | "groq">("anthropic");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [useOllama, setUseOllama] = useState(false);

  const handleNameSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalName = nameInput.trim() || "User";
    onUpdateUserName(finalName);
    gatewayClient
      .rememberMemory(`User prefers to be called ${finalName}`, "identity")
      .catch(() => {});
    setStep(2);
  };

  const handleAccentChange = (color: string) => {
    onUpdateAccentColor(color);
    document.documentElement.style.setProperty("--accent-teal", color);
    document.documentElement.style.setProperty("--accent-teal-glow", `${color}33`);
    document.documentElement.style.setProperty("--accent-teal-subtle", `${color}14`);
  };

  const handleThemeChange = (mode: "dark" | "light") => {
    onUpdateThemeMode(mode);
    document.documentElement.setAttribute("data-theme", mode);
  };

  const handleLayoutSelect = (mode: "basic" | "pro") => {
    onUpdateLayoutMode(mode);
  };

  const handleFinishConnection = () => {
    if (!useOllama && apiKeyInput.trim()) {
      onSaveApiKey(selectedProvider, apiKeyInput.trim());
    }
    onFinish();
  };

  return (
    <div
      style={{
        maxWidth: "680px",
        width: "100%",
        margin: "0 auto",
        padding: "32px 20px 48px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        animation: "fadeIn 0.25s ease",
      }}
    >
      {/* Top Header / Skip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: "12px",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <CoreBlowEmblem size={20} color="var(--accent-teal)" />
          <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink-primary)" }}>
            Welcome to CoreBlow
          </span>
          <span style={{ fontSize: "11px", color: "var(--ink-muted)" }}>• Step {step} of 4</span>
        </div>
        <button
          type="button"
          onClick={onSkip}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--ink-muted)",
            fontSize: "12px",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Skip setup
        </button>
      </div>

      {/* STEP 1: NAME CARD */}
      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "10px",
                background: "rgba(45, 212, 191, 0.12)",
                border: "1px solid rgba(45, 212, 191, 0.25)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <CoreBlowEmblem size={18} color="var(--accent-teal)" />
            </div>
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "14px",
                padding: "14px 18px",
                color: "var(--ink-primary)",
                fontSize: "14px",
                lineHeight: 1.5,
              }}
            >
              Hi, I'm <strong>CoreBlow</strong>. Let's set things up for you. Then we'll get something
              cool done.
            </div>
          </div>

          <form
            onSubmit={handleNameSubmit}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-medium)",
              borderRadius: "16px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              marginLeft: "44px",
            }}
          >
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-secondary)" }}>
              What should I call you?
            </label>
            <input
              type="text"
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Your name or callsign"
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-medium)",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "14px",
                color: "var(--ink-primary)",
                outline: "none",
                fontFamily: "var(--font-sans)",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                style={{
                  background: "var(--accent-teal)",
                  color: "#08110F",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 20px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Continue →
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 2: ACCENT COLOR & THEME MODE */}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "10px",
                background: "rgba(45, 212, 191, 0.12)",
                border: "1px solid rgba(45, 212, 191, 0.25)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <CoreBlowEmblem size={18} color="var(--accent-teal)" />
            </div>
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "14px",
                padding: "14px 18px",
                color: "var(--ink-primary)",
                fontSize: "14px",
                lineHeight: 1.5,
              }}
            >
              Hi, <strong>{nameInput.trim() || "friend"}</strong>. Pick a colour and appearance that
              fits your style.
            </div>
          </div>

          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-medium)",
              borderRadius: "16px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              marginLeft: "44px",
            }}
          >
            {/* Color Swatches */}
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-secondary)", marginBottom: "10px" }}>
                Accent Colour
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {ACCENT_SWATCHES.map((swatch) => {
                  const isSelected = accentColor.toLowerCase() === swatch.color.toLowerCase();
                  return (
                    <button
                      key={swatch.name}
                      type="button"
                      onClick={() => handleAccentChange(swatch.color)}
                      title={swatch.name}
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: swatch.color,
                        border: isSelected ? "3px solid #FFFFFF" : "2px solid transparent",
                        boxShadow: isSelected ? `0 0 12px ${swatch.color}` : "none",
                        cursor: "pointer",
                        display: "grid",
                        placeItems: "center",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {isSelected && <CheckIcon size={14} color="#08110F" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Theme Toggle */}
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-secondary)", marginBottom: "8px" }}>
                Theme Mode
              </div>
              <div style={{ display: "inline-flex", background: "var(--bg-chip)", borderRadius: "8px", padding: "3px" }}>
                <button
                  type="button"
                  onClick={() => handleThemeChange("dark")}
                  style={{
                    background: themeMode === "dark" ? "var(--bg-card)" : "transparent",
                    color: themeMode === "dark" ? "var(--accent-teal)" : "var(--ink-muted)",
                    border: "none",
                    borderRadius: "6px",
                    padding: "6px 16px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Dark
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange("light")}
                  style={{
                    background: themeMode === "light" ? "var(--bg-card)" : "transparent",
                    color: themeMode === "light" ? "var(--accent-teal)" : "var(--ink-muted)",
                    border: "none",
                    borderRadius: "6px",
                    padding: "6px 16px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Light
                </button>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setStep(3)}
                style={{
                  background: "var(--accent-teal)",
                  color: "#08110F",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 20px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Continue →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: BASIC VS PRO LAYOUT */}
      {step === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "10px",
                background: "rgba(45, 212, 191, 0.12)",
                border: "1px solid rgba(45, 212, 191, 0.25)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <CoreBlowEmblem size={18} color="var(--accent-teal)" />
            </div>
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "14px",
                padding: "14px 18px",
                color: "var(--ink-primary)",
                fontSize: "14px",
                lineHeight: 1.5,
              }}
            >
              Which layout suits your daily workflow?
            </div>
          </div>

          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-medium)",
              borderRadius: "16px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              marginLeft: "44px",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {/* BASIC CARD */}
              <div
                data-testid="basic-card"
                onClick={() => handleLayoutSelect("basic")}
                style={{
                  border:
                    layoutMode === "basic"
                      ? "2px solid var(--accent-teal)"
                      : "1px solid var(--border-medium)",
                  background: layoutMode === "basic" ? "rgba(45, 212, 191, 0.06)" : "var(--bg-input)",
                  borderRadius: "12px",
                  padding: "16px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  transition: "all 0.15s ease",
                }}
              >
                {/* Visual Wireframe */}
                <div
                  style={{
                    height: "70px",
                    borderRadius: "6px",
                    background: "rgba(0, 0, 0, 0.3)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    overflow: "hidden",
                    padding: "6px",
                    gap: "6px",
                  }}
                >
                  <div style={{ width: "24%", height: "100%", background: "rgba(255, 255, 255, 0.08)", borderRadius: "4px" }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "4px" }}>
                    <div style={{ width: "60%", height: "8px", background: "rgba(45, 212, 191, 0.3)", borderRadius: "3px" }} />
                    <div style={{ width: "80%", height: "16px", background: "rgba(255, 255, 255, 0.06)", borderRadius: "4px" }} />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink-primary)" }}>
                    Basic
                  </span>
                  {layoutMode === "basic" && <CheckIcon size={14} color="var(--accent-teal)" />}
                </div>
                <p style={{ fontSize: "11px", color: "var(--ink-secondary)", lineHeight: 1.4, margin: 0 }}>
                  For everyday use: clean chat, voice, and automatic memory.
                </p>
              </div>

              {/* PRO CARD */}
              <div
                data-testid="pro-card"
                onClick={() => handleLayoutSelect("pro")}
                style={{
                  border:
                    layoutMode === "pro"
                      ? "2px solid var(--accent-teal)"
                      : "1px solid var(--border-medium)",
                  background: layoutMode === "pro" ? "rgba(45, 212, 191, 0.06)" : "var(--bg-input)",
                  borderRadius: "12px",
                  padding: "16px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  transition: "all 0.15s ease",
                }}
              >
                {/* Visual Wireframe */}
                <div
                  style={{
                    height: "70px",
                    borderRadius: "6px",
                    background: "rgba(0, 0, 0, 0.3)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    overflow: "hidden",
                    padding: "6px",
                    gap: "4px",
                  }}
                >
                  <div style={{ width: "22%", height: "100%", background: "rgba(255, 255, 255, 0.08)", borderRadius: "3px" }} />
                  <div style={{ flex: 1, height: "100%", background: "rgba(255, 255, 255, 0.04)", borderRadius: "3px" }} />
                  <div style={{ width: "30%", height: "100%", background: "rgba(45, 212, 191, 0.2)", borderRadius: "3px" }} />
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink-primary)" }}>
                    Pro
                  </span>
                  {layoutMode === "pro" && <CheckIcon size={14} color="var(--accent-teal)" />}
                </div>
                <p style={{ fontSize: "11px", color: "var(--ink-secondary)", lineHeight: 1.4, margin: 0 }}>
                  For developers: terminal, files, git gates, War Room, and diffs.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setStep(4)}
                style={{
                  background: "var(--accent-teal)",
                  color: "#08110F",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 20px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Continue →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: QUICK AI CONNECTION */}
      {step === 4 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "10px",
                background: "rgba(45, 212, 191, 0.12)",
                border: "1px solid rgba(45, 212, 191, 0.25)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <CoreBlowEmblem size={18} color="var(--accent-teal)" />
            </div>
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "14px",
                padding: "14px 18px",
                color: "var(--ink-primary)",
                fontSize: "14px",
                lineHeight: 1.5,
              }}
            >
              Connect an AI model backend. You can use your own API key or connect completely offline
              with Local Ollama.
            </div>
          </div>

          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-medium)",
              borderRadius: "16px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              marginLeft: "44px",
            }}
          >
            {/* Option 1: Cloud Provider Key */}
            <div
              style={{
                padding: "12px",
                borderRadius: "10px",
                background: !useOllama ? "rgba(45, 212, 191, 0.05)" : "transparent",
                border: !useOllama ? "1px solid var(--border-medium)" : "1px solid var(--border-subtle)",
              }}
            >
              <label
                onClick={() => setUseOllama(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--ink-primary)",
                  cursor: "pointer",
                  marginBottom: "10px",
                }}
              >
                <input
                  type="radio"
                  name="ai_choice"
                  checked={!useOllama}
                  onChange={() => setUseOllama(false)}
                />
                Cloud Provider API Key
              </label>

              {!useOllama && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <select
                      value={selectedProvider}
                      onChange={(e) => setSelectedProvider(e.target.value as any)}
                      style={{
                        background: "var(--bg-input)",
                        border: "1px solid var(--border-medium)",
                        borderRadius: "6px",
                        padding: "6px 10px",
                        color: "var(--ink-primary)",
                        fontSize: "12px",
                        outline: "none",
                      }}
                    >
                      <option value="anthropic">Anthropic</option>
                      <option value="openai">OpenAI</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="groq">Groq</option>
                    </select>

                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder={`Paste ${selectedProvider} API key`}
                      style={{
                        flex: 1,
                        background: "var(--bg-input)",
                        border: "1px solid var(--border-medium)",
                        borderRadius: "6px",
                        padding: "6px 10px",
                        fontSize: "12px",
                        color: "var(--ink-primary)",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Option 2: Local Ollama */}
            <div
              style={{
                padding: "12px",
                borderRadius: "10px",
                background: useOllama ? "rgba(45, 212, 191, 0.05)" : "transparent",
                border: useOllama ? "1px solid var(--border-medium)" : "1px solid var(--border-subtle)",
              }}
            >
              <label
                onClick={() => setUseOllama(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--ink-primary)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="ai_choice"
                  checked={useOllama}
                  onChange={() => setUseOllama(true)}
                />
                Local Ollama (127.0.0.1:11434)
              </label>
              {useOllama && (
                <div style={{ fontSize: "11px", color: "var(--ink-secondary)", marginTop: "6px", marginLeft: "24px" }}>
                  CoreBlow will route requests locally to your active Ollama instance without external keys.
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
              <button
                type="button"
                onClick={onFinish}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--ink-muted)",
                  fontSize: "12px",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Skip for now
              </button>

              <button
                type="button"
                onClick={handleFinishConnection}
                style={{
                  background: "var(--accent-teal)",
                  color: "#08110F",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 24px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Finish & Start →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
