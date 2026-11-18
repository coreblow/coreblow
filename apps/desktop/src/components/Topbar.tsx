import React from "react";
import type { ActiveProjectState } from "../types/gateway";
import { FolderIcon, GitBranchIcon, InspectorIcon, RefreshIcon } from "./Icons";

interface TopbarProps {
  sidebarCollapsed: boolean;
  project: ActiveProjectState;
  onChangeProject: (newPath: string) => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  gatewayHealthy: boolean;
  onReconnectGateway: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  sidebarCollapsed,
  project,
  onChangeProject,
  inspectorOpen,
  onToggleInspector,
  gatewayHealthy,
  onReconnectGateway,
}) => {
  const isMac = window.coreblowDesktop?.platform === "darwin";
  const paddingLeft = sidebarCollapsed ? (isMac ? "88px" : "12px") : "12px";
  const paddingRight = isMac ? "16px" : "148px";

  const handleSelectFolder = async () => {
    if (window.coreblowDesktop) {
      const selected = await window.coreblowDesktop.dialog.selectDirectory();
      if (selected) {
        onChangeProject(selected);
      }
    }
  };

  return (
    <header
      data-window-drag
      style={{
        height: "var(--topbar-height)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `0 ${paddingRight} 0 ${paddingLeft}`,
        background: "var(--bg-canvas)",
        borderBottom: "1px solid var(--border-subtle)",
        boxSizing: "border-box",
        flexShrink: 0,
        transition: "padding-left 0.2s ease",
      }}
    >
      {/* Active Project & Git Branch Pill (⌘O) */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          type="button"
          onClick={handleSelectFolder}
          title="Change active project directory (⌘O)"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            height: "28px",
            padding: "0 10px",
            background: "var(--bg-chip)",
            border: "1px solid var(--border-medium)",
            borderRadius: "var(--radius-sm)",
            color: "var(--ink-primary)",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <FolderIcon size={13} color="var(--accent-teal)" />
          <span style={{ maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {project.name}
          </span>
          <span style={{ color: "var(--border-strong)" }}>/</span>
          <GitBranchIcon size={12} color="var(--ink-secondary)" />
          <span style={{ color: "var(--ink-secondary)", maxWidth: "100px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {project.branch}
          </span>
        </button>
      </div>

      {/* Right Controls: Gateway Indicator & Inspector Toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {/* Gateway Connection Health Pill */}
        <button
          type="button"
          onClick={onReconnectGateway}
          title={gatewayHealthy ? "Single-Brain Gateway connected (127.0.0.1:18789)" : "Gateway disconnected. Click to reconnect."}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            height: "26px",
            padding: "0 8px",
            background: gatewayHealthy ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)",
            border: `1px solid ${gatewayHealthy ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.3)"}`,
            borderRadius: "var(--radius-xs)",
            color: gatewayHealthy ? "var(--state-success)" : "var(--state-error)",
            fontSize: "11px",
            cursor: "pointer",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: gatewayHealthy ? "var(--state-success)" : "var(--state-error)",
              boxShadow: gatewayHealthy ? "0 0 6px var(--state-success)" : "none",
            }}
          />
          <span>{gatewayHealthy ? "18789 Online" : "18789 Offline"}</span>
          {!gatewayHealthy && <RefreshIcon size={11} />}
        </button>

        {/* Inspector Toggle (⌘I) */}
        <button
          type="button"
          onClick={onToggleInspector}
          title="Toggle Right Inspector (⌘I)"
          style={{
            width: "30px",
            height: "30px",
            borderRadius: "var(--radius-sm)",
            background: inspectorOpen ? "var(--bg-chip)" : "transparent",
            border: inspectorOpen ? "1px solid var(--border-medium)" : "1px solid transparent",
            color: inspectorOpen ? "var(--accent-teal)" : "var(--ink-secondary)",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <InspectorIcon size={16} />
        </button>
      </div>
    </header>
  );
};
