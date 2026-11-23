import React from "react";
import { InspectorIcon } from "./Icons";

export interface TopbarProps {
  sidebarCollapsed: boolean;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  sidebarCollapsed,
  inspectorOpen,
  onToggleInspector,
}) => {
  const isMac = window.coreblowDesktop?.platform === "darwin";
  const paddingLeft = sidebarCollapsed ? (isMac ? "80px" : "12px") : "12px";
  const paddingRight = "14px";

  return (
    <header
      data-window-drag
      style={{
        height: "var(--topbar-height, 44px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `0 ${paddingRight} 0 ${paddingLeft}`,
        background: "var(--bg-canvas)",
        borderBottom: "1px solid var(--border-subtle)",
        boxSizing: "border-box",
        flexShrink: 0,
        transition: "padding-left 0.2s ease",
        position: "relative",
      }}
    >
      {/* Left region — clean whitespace for window drag */}
      <div style={{ display: "flex", alignItems: "center" }} />

      {/* Right side: Single Right Panel Toggle */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <button
          type="button"
          onClick={onToggleInspector}
          title="Toggle Workspace Panel (⌘I)"
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "var(--radius-sm, 6px)",
            background: inspectorOpen ? "var(--accent-teal-subtle)" : "transparent",
            border: "none",
            color: inspectorOpen ? "var(--accent-teal)" : "var(--ink-secondary)",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            if (!inspectorOpen) {
              e.currentTarget.style.background = "var(--bg-hover)";
              e.currentTarget.style.color = "var(--ink-primary)";
            }
          }}
          onMouseLeave={(e) => {
            if (!inspectorOpen) {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--ink-secondary)";
            }
          }}
        >
          <InspectorIcon size={15} />
        </button>
      </div>
    </header>
  );
};
