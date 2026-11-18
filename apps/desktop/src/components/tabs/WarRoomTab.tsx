import React from "react";
import { SparklesIcon, TerminalIcon } from "../Icons";

export const WarRoomTab: React.FC = () => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Coordinator Status */}
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-md)",
          padding: "12px",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink-muted)", marginBottom: "8px", letterSpacing: "0.05em" }}>
          COGNITIVE COORDINATOR
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "var(--accent-teal)",
              boxShadow: "0 0 8px var(--accent-teal)",
            }}
          />
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-primary)" }}>
            Microkernel Coordinator Active
          </span>
        </div>
        <div style={{ fontSize: "12px", color: "var(--ink-secondary)", lineHeight: 1.5 }}>
          Orchestrating autonomous ReAct loops with zero state bifurcation. Single-Brain Gateway authoritative.
        </div>
      </div>

      {/* Active Subagent Roster */}
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-md)",
          padding: "12px",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink-muted)", marginBottom: "12px", letterSpacing: "0.05em" }}>
          ACTIVE SUBAGENT ROSTER
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 8px",
              background: "var(--bg-chip)",
              borderRadius: "var(--radius-xs)",
              fontSize: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <TerminalIcon size={12} color="var(--accent-teal)" />
              <span style={{ fontWeight: 500 }}>coreblow-infra-worker</span>
            </div>
            <span style={{ fontSize: "11px", color: "var(--state-success)" }}>Ready</span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 8px",
              background: "var(--bg-chip)",
              borderRadius: "var(--radius-xs)",
              fontSize: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <SparklesIcon size={12} color="var(--accent-teal)" />
              <span style={{ fontWeight: 500 }}>cory-memory-daemon</span>
            </div>
            <span style={{ fontSize: "11px", color: "var(--state-success)" }}>Indexing</span>
          </div>
        </div>
      </div>
    </div>
  );
};
