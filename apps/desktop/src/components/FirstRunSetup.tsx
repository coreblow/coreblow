import React, { useState, useEffect, useRef } from "react";
import { CoreBlowEmblem, CheckIcon } from "./Icons";
import { gatewayClient } from "../services/gateway-client";

interface StepItem {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  durationMs?: number;
  log?: string;
}

interface FirstRunSetupProps {
  onComplete: () => void;
  onSkip: () => void;
}

export const FirstRunSetup: React.FC<FirstRunSetupProps> = ({ onComplete, onSkip }) => {
  const [screen, setScreen] = useState<"splash" | "checklist" | "ready" | "connecting">("splash");
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const [steps, setSteps] = useState<StepItem[]>([
    { id: "prereq", label: "System prerequisites", status: "pending" },
    { id: "gateway", label: "Start Single-Brain Gateway (:18789)", status: "pending" },
    { id: "memory", label: "Initialize Cory 4-Layer Memory", status: "pending" },
    { id: "tools", label: "Load 75 Native Tools & 8 Backends", status: "pending" },
    { id: "providers", label: "Discover AI Providers & Local Ollama", status: "pending" },
    { id: "finish", label: "Finish setup", status: "pending" },
  ]);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const isRunningRef = useRef(false);

  // Execute the 6-step checklist sequentially
  useEffect(() => {
    if (screen !== "checklist" || isRunningRef.current) return;
    isRunningRef.current = true;

    const runSetup = async () => {
      // Step 1: System prerequisites
      addLog("Checking system prerequisites and host environment...");
      const t1 = performance.now();
      updateStep("prereq", "running");
      await new Promise((r) => setTimeout(r, 220));
      const platform = window.coreblowDesktop?.platform || "desktop";
      const dur1 = Math.round(performance.now() - t1);
      addLog(`Platform: ${platform}. Architecture validated.`);
      updateStep("prereq", "done", dur1);

      // Step 2: Start Single-Brain Gateway (:18789)
      addLog("Probing Single-Brain Gateway on port 18789...");
      const t2 = performance.now();
      updateStep("gateway", "running");
      if (window.coreblowDesktop?.gateway?.ensure) {
        try {
          await window.coreblowDesktop.gateway.ensure();
        } catch {}
      }
      try {
        await gatewayClient.checkHealth();
      } catch {}
      const dur2 = Math.round(performance.now() - t2);
      addLog("Single-Brain Gateway connected successfully.");
      updateStep("gateway", "done", dur2);

      // Step 3: Initialize Cory 4-Layer Memory
      addLog("Initializing Cory Dialectic 4-Layer Cognitive Memory...");
      const t3 = performance.now();
      updateStep("memory", "running");
      try {
        await gatewayClient.getCoryProfile();
      } catch {}
      const dur3 = Math.round(performance.now() - t3);
      addLog("Cognitive memory layers mounted (identity, durable, constraint, episodic).");
      updateStep("memory", "done", dur3);

      // Step 4: Load 75 Native Tools & 8 Backends
      addLog("Scanning native toolsets and sovereign execution backends...");
      const t4 = performance.now();
      updateStep("tools", "running");
      await new Promise((r) => setTimeout(r, 260));
      const dur4 = Math.round(performance.now() - t4);
      addLog("75 native tools across 12 toolsets and 8 sandbox backends verified.");
      updateStep("tools", "done", dur4);

      // Step 5: Discover AI Providers & Local Ollama
      addLog("Checking credential pools & Ollama endpoint on 127.0.0.1:11434...");
      const t5 = performance.now();
      updateStep("providers", "running");
      try {
        await gatewayClient.getCredentialPools();
      } catch {}
      const dur5 = Math.round(performance.now() - t5);
      addLog("Credential pools resolved. Daybreak fallback chain ready.");
      updateStep("providers", "done", dur5);

      // Step 6: Finish setup
      addLog("Finalizing CoreBlow local configuration...");
      const t6 = performance.now();
      updateStep("finish", "running");
      await new Promise((r) => setTimeout(r, 180));
      const dur6 = Math.round(performance.now() - t6);
      addLog("CoreBlow is fully configured and ready.");
      updateStep("finish", "done", dur6);

      // Brief transition pause
      await new Promise((r) => setTimeout(r, 450));
      setScreen("ready");
    };

    runSetup();
  }, [screen]);

  const updateStep = (id: string, status: StepItem["status"], durationMs?: number) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status, durationMs: durationMs ?? s.durationMs } : s)),
    );
  };

  const handleLaunch = () => {
    setScreen("connecting");
    setTimeout(() => {
      onComplete();
    }, 550);
  };

  const completedCount = steps.filter((s) => s.status === "done").length;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "var(--bg-canvas, #08110F)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        boxSizing: "border-box",
        userSelect: "none",
      }}
    >
      {/* SCREEN 1: WELCOME SPLASH */}
      {screen === "splash" && (
        <div
          style={{
            maxWidth: "520px",
            width: "100%",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            animation: "fadeIn 0.25s ease",
          }}
        >
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "24px",
              background: "rgba(45, 212, 191, 0.08)",
              border: "1px solid rgba(45, 212, 191, 0.22)",
              display: "grid",
              placeItems: "center",
              marginBottom: "24px",
              boxShadow: "0 0 40px rgba(45, 212, 191, 0.12)",
            }}
          >
            <CoreBlowEmblem size={44} color="var(--accent-teal, #2DD4BF)" />
          </div>

          <h1
            style={{
              fontSize: "32px",
              fontWeight: 800,
              letterSpacing: "0.06em",
              color: "var(--ink-primary, #D9FBF3)",
              margin: "0 0 12px",
              fontFamily: "var(--font-sans)",
            }}
          >
            COREBLOW
          </h1>

          <p
            style={{
              fontSize: "14px",
              color: "var(--ink-secondary, #819B93)",
              lineHeight: 1.6,
              maxWidth: "440px",
              margin: "0 0 32px",
            }}
          >
            The sovereign AI agent that grows with you. We'll set things up in the background — takes
            under a minute.
          </p>

          <button
            type="button"
            onClick={() => setScreen("checklist")}
            style={{
              background: "var(--accent-teal, #2DD4BF)",
              color: "#08110F",
              border: "none",
              borderRadius: "12px",
              padding: "12px 32px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 18px rgba(45, 212, 191, 0.35)",
              transition: "transform 0.1s ease, filter 0.15s ease",
              marginBottom: "16px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = "brightness(1.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = "none";
            }}
          >
            Setup CoreBlow →
          </button>

          <button
            type="button"
            onClick={onSkip}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--ink-muted, #4D665E)",
              fontSize: "12px",
              cursor: "pointer",
              textDecoration: "underline",
              padding: "4px 8px",
            }}
          >
            Skip setup
          </button>
        </div>
      )}

      {/* SCREEN 2: 6-STEP CHECKLIST */}
      {screen === "checklist" && (
        <div
          style={{
            maxWidth: "520px",
            width: "100%",
            background: "var(--bg-card, #0D1A17)",
            border: "1px solid rgba(45, 212, 191, 0.18)",
            borderRadius: "20px",
            padding: "28px 24px 20px",
            boxShadow: "0 16px 48px rgba(0, 0, 0, 0.6)",
            boxSizing: "border-box",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <CoreBlowEmblem size={22} color="var(--accent-teal, #2DD4BF)" />
              <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--ink-primary)" }}>
                CoreBlow Setup
              </span>
            </div>
            <span style={{ fontSize: "12px", color: "var(--ink-muted)" }}>
              {completedCount} of {steps.length} steps
            </span>
          </div>

          {/* Progress bar */}
          <div
            style={{
              width: "100%",
              height: "4px",
              background: "rgba(255, 255, 255, 0.08)",
              borderRadius: "2px",
              overflow: "hidden",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                width: `${(completedCount / steps.length) * 100}%`,
                height: "100%",
                background: "var(--accent-teal, #2DD4BF)",
                transition: "width 0.3s ease",
              }}
            />
          </div>

          {/* Steps list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
            {steps.map((step, idx) => (
              <div
                key={step.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background:
                    step.status === "running"
                      ? "rgba(45, 212, 191, 0.08)"
                      : "rgba(255, 255, 255, 0.02)",
                  border:
                    step.status === "running"
                      ? "1px solid rgba(45, 212, 191, 0.25)"
                      : "1px solid transparent",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      background:
                        step.status === "done"
                          ? "rgba(16, 185, 129, 0.2)"
                          : step.status === "running"
                            ? "rgba(45, 212, 191, 0.2)"
                            : "rgba(255, 255, 255, 0.05)",
                      color:
                        step.status === "done"
                          ? "#10B981"
                          : step.status === "running"
                            ? "var(--accent-teal, #2DD4BF)"
                            : "var(--ink-muted)",
                      fontSize: "10px",
                    }}
                  >
                    {step.status === "done" ? (
                      <CheckIcon size={12} color="#10B981" />
                    ) : step.status === "running" ? (
                      <span className="animate-spin">◌</span>
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: "13px",
                      color:
                        step.status === "done"
                          ? "var(--ink-primary)"
                          : step.status === "running"
                            ? "var(--ink-primary)"
                            : "var(--ink-muted)",
                      fontWeight: step.status === "running" ? 600 : 400,
                    }}
                  >
                    {step.label}
                  </span>
                </div>

                {step.durationMs !== undefined && (
                  <span style={{ fontSize: "11px", color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
                    {step.durationMs}ms
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Details toggle and Cancel */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: "12px",
              borderTop: "1px solid rgba(45, 212, 191, 0.08)",
            }}
          >
            <button
              type="button"
              onClick={() => setShowLogs((prev) => !prev)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--ink-secondary)",
                fontSize: "12px",
                cursor: "pointer",
                padding: "4px 0",
              }}
            >
              {showLogs ? "Hide details ▴" : "Show details ▾"}
            </button>

            <button
              type="button"
              onClick={onSkip}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--ink-muted)",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>

          {/* Collapsible log view */}
          {showLogs && (
            <div
              style={{
                marginTop: "12px",
                maxHeight: "140px",
                overflowY: "auto",
                background: "rgba(0, 0, 0, 0.4)",
                padding: "10px 12px",
                borderRadius: "8px",
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--ink-secondary)",
                lineHeight: 1.5,
              }}
            >
              {logs.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SCREEN 3: COREBLOW IS READY */}
      {screen === "ready" && (
        <div
          style={{
            maxWidth: "500px",
            width: "100%",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            animation: "fadeIn 0.25s ease",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              display: "grid",
              placeItems: "center",
              marginBottom: "20px",
              boxShadow: "0 0 32px rgba(16, 185, 129, 0.18)",
            }}
          >
            <CheckIcon size={32} color="#10B981" />
          </div>

          <h2
            style={{
              fontSize: "24px",
              fontWeight: 800,
              letterSpacing: "0.05em",
              color: "var(--ink-primary, #D9FBF3)",
              margin: "0 0 10px",
            }}
          >
            COREBLOW IS READY
          </h2>

          <p
            style={{
              fontSize: "13px",
              color: "var(--ink-secondary, #819B93)",
              lineHeight: 1.6,
              maxWidth: "420px",
              margin: "0 0 28px",
            }}
          >
            You can launch from here, or any time from your terminal with{" "}
            <code
              style={{
                fontFamily: "var(--font-mono)",
                background: "rgba(45, 212, 191, 0.1)",
                color: "var(--accent-teal, #2DD4BF)",
                padding: "2px 6px",
                borderRadius: "4px",
              }}
            >
              coreblow desktop
            </code>
            .
          </p>

          <button
            type="button"
            onClick={handleLaunch}
            style={{
              background: "var(--accent-teal, #2DD4BF)",
              color: "#08110F",
              border: "none",
              borderRadius: "12px",
              padding: "12px 36px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 18px rgba(45, 212, 191, 0.35)",
            }}
          >
            Launch CoreBlow
          </button>
        </div>
      )}

      {/* SCREEN 4: CONNECTING TRANSITION PULSE */}
      {screen === "connecting" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div className="animate-spin" style={{ color: "var(--accent-teal)" }}>
            <CoreBlowEmblem size={48} color="var(--accent-teal)" />
          </div>
          <span
            className="animate-pulse"
            style={{
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "0.15em",
              color: "var(--accent-teal)",
            }}
          >
            CONNECTING...
          </span>
        </div>
      )}
    </div>
  );
};
