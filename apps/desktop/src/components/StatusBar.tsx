import React from "react";
import { SparklesIcon } from "./Icons";

export interface StatusBarProps {
  gatewayHealthy: boolean;
  activeNodeName?: string;
  activeModelName?: string;
  layoutMode: "basic" | "pro";
  onToggleLayoutMode?: () => void;
  version?: string;
  estopPaused?: boolean;
  onToggleEstop?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  gatewayHealthy,
  activeNodeName = "Local :18789",
  activeModelName = "Auto",
  layoutMode,
  onToggleLayoutMode,
  version = "v2.3.1",
  estopPaused = false,
  onToggleEstop,
}) => {
  return (
    <footer
      style={{
        height: "24px",
        background: "var(--bg-sidebar, #09130F)",
        borderTop: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        fontSize: "11px",
        color: "var(--ink-muted)",
        boxSizing: "border-box",
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      {/* Left items: Gateway health, active node & model */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: gatewayHealthy ? "var(--state-success)" : "var(--state-error)",
              boxShadow: gatewayHealthy ? "0 0 6px var(--state-success)" : "none",
            }}
          />
          <span style={{ color: gatewayHealthy ? "var(--ink-secondary)" : "var(--state-error)" }}>
            {gatewayHealthy ? "Gateway ready" : "Offline"}
          </span>
        </div>

        <span style={{ opacity: 0.3 }}>|</span>

        <span style={{ color: "var(--ink-secondary)" }}>{activeNodeName}</span>

        <span style={{ opacity: 0.3 }}>|</span>

        <span
          style={{
            color: "var(--ink-secondary)",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <SparklesIcon size={10} color="var(--accent-teal)" />
          {activeModelName}
        </span>
      </div>

      {/* Right items: Smart router badge, Layout Mode toggle, Version */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <button
          type="button"
          onClick={onToggleEstop}
          title={
            estopPaused
              ? "Autonomous execution is PAUSED by Global Emergency Stop. Click to resume."
              : "Emergency Stop (E-Stop): Click to pause autonomous agent execution"
          }
          style={{
            background: estopPaused ? "rgba(239, 68, 68, 0.15)" : "var(--bg-chip)",
            border: estopPaused ? "1px solid var(--state-error)" : "1px solid var(--border-subtle)",
            color: estopPaused ? "var(--state-error)" : "var(--ink-secondary)",
            fontSize: "10px",
            fontWeight: 600,
            cursor: "pointer",
            padding: "2px 7px",
            borderRadius: "var(--radius-xs)",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            userSelect: "none",
            transition: "all 0.15s ease",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: estopPaused ? "var(--state-error)" : "var(--state-success)",
              boxShadow: estopPaused ? "0 0 6px var(--state-error)" : "none",
            }}
          />
          {estopPaused ? "PAUSED (E-Stop)" : "E-Stop"}
        </button>

        <span
          style={{
            background: "var(--accent-teal-subtle)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "4px",
            padding: "1px 6px",
            fontSize: "10px",
            color: "var(--accent-teal)",
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          Smart Router
        </span>

        <button
          type="button"
          onClick={onToggleLayoutMode}
          title={`Click to switch to ${layoutMode === "basic" ? "Pro" : "Basic"} layout`}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--ink-secondary)",
            fontSize: "11px",
            cursor: "pointer",
            padding: "1px 4px",
            borderRadius: "4px",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--ink-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--ink-secondary)";
          }}
        >
          Layout:{" "}
          <strong
            style={{
              color: layoutMode === "pro" ? "var(--accent-teal)" : "var(--ink-primary)",
              fontWeight: 600,
            }}
          >
            {layoutMode === "pro" ? "Pro" : "Basic"}
          </strong>
        </button>

        <span
          style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--ink-muted)" }}
        >
          {version}
        </span>
      </div>
    </footer>
  );
};
