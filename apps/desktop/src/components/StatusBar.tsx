import React from "react";
import { SparklesIcon } from "./Icons";

export interface StatusBarProps {
  gatewayHealthy: boolean;
  activeNodeName?: string;
  activeModelName?: string;
  layoutMode: "basic" | "pro";
  onToggleLayoutMode?: () => void;
  version?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  gatewayHealthy,
  activeNodeName = "Local :18789",
  activeModelName = "Auto",
  layoutMode,
  onToggleLayoutMode,
  version = "v2.0.0",
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
              background: gatewayHealthy ? "#10B981" : "#EF4444",
              boxShadow: gatewayHealthy ? "0 0 6px #10B981" : "none",
            }}
          />
          <span style={{ color: gatewayHealthy ? "var(--ink-secondary)" : "var(--state-error)" }}>
            {gatewayHealthy ? "Gateway ready" : "Offline"}
          </span>
        </div>

        <span style={{ opacity: 0.3 }}>|</span>

        <span style={{ color: "var(--ink-secondary)" }}>{activeNodeName}</span>

        <span style={{ opacity: 0.3 }}>|</span>

        <span style={{ color: "var(--ink-secondary)", display: "flex", alignItems: "center", gap: "4px" }}>
          <SparklesIcon size={10} color="var(--accent-teal)" />
          {activeModelName}
        </span>
      </div>

      {/* Right items: Smart router badge, Layout Mode toggle, Version */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span
          style={{
            background: "rgba(45, 212, 191, 0.08)",
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

        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--ink-muted)" }}>
          {version}
        </span>
      </div>
    </footer>
  );
};
