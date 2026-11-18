import React, { useState } from "react";
import type { ActiveProjectState } from "../types/gateway";
import { GitGatesTab } from "./tabs/GitGatesTab";
import { WarRoomTab } from "./tabs/WarRoomTab";
import { MemoryWikiTab } from "./tabs/MemoryWikiTab";
import { CloseIcon, TerminalIcon } from "./Icons";

interface InspectorDrawerProps {
  open: boolean;
  onClose: () => void;
  activeTab: "git" | "warroom" | "memory";
  onChangeTab: (tab: "git" | "warroom" | "memory") => void;
  project: ActiveProjectState;
}

export const InspectorDrawer: React.FC<InspectorDrawerProps> = ({
  open,
  onClose,
  activeTab,
  onChangeTab,
  project,
}) => {
  const [showTerminalDrawer, setShowTerminalDrawer] = useState(false);

  if (!open) return null;

  return (
    <aside
      style={{
        width: "340px",
        height: "100%",
        background: "var(--bg-canvas)",
        borderLeft: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        flexShrink: 0,
        zIndex: 10,
        overflow: "hidden",
      }}
    >
      {/* Top Header & Tab Selector */}
      <div
        style={{
          height: "var(--topbar-height)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          borderBottom: "1px solid var(--border-subtle)",
          boxSizing: "border-box",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <button
            type="button"
            onClick={() => onChangeTab("git")}
            style={{
              padding: "4px 8px",
              borderRadius: "var(--radius-xs)",
              background: activeTab === "git" ? "var(--bg-chip)" : "transparent",
              border: "none",
              color: activeTab === "git" ? "var(--accent-teal)" : "var(--ink-secondary)",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Git & Gates
          </button>
          <button
            type="button"
            onClick={() => onChangeTab("warroom")}
            style={{
              padding: "4px 8px",
              borderRadius: "var(--radius-xs)",
              background: activeTab === "warroom" ? "var(--bg-chip)" : "transparent",
              border: "none",
              color: activeTab === "warroom" ? "var(--accent-teal)" : "var(--ink-secondary)",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            War Room
          </button>
          <button
            type="button"
            onClick={() => onChangeTab("memory")}
            style={{
              padding: "4px 8px",
              borderRadius: "var(--radius-xs)",
              background: activeTab === "memory" ? "var(--bg-chip)" : "transparent",
              border: "none",
              color: activeTab === "memory" ? "var(--accent-teal)" : "var(--ink-secondary)",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Memory Wiki
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          title="Close Inspector"
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
          <CloseIcon size={14} />
        </button>
      </div>

      {/* Main Tab Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
        {activeTab === "git" && (
          <GitGatesTab branch={project.branch} uncommittedFiles={project.uncommittedFiles} />
        )}
        {activeTab === "warroom" && <WarRoomTab />}
        {activeTab === "memory" && <MemoryWikiTab />}
      </div>

      {/* Bottom Integrated Terminal / Diff Preview Section */}
      <div
        style={{
          borderTop: "1px solid var(--border-subtle)",
          background: "var(--bg-card)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <button
          type="button"
          onClick={() => setShowTerminalDrawer(!showTerminalDrawer)}
          style={{
            height: "34px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 12px",
            background: "transparent",
            border: "none",
            color: "var(--ink-secondary)",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <TerminalIcon size={13} color="var(--accent-teal)" />
            Terminal / Diff Logs
          </span>
          <span style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
            {showTerminalDrawer ? "Hide" : "Show"}
          </span>
        </button>

        {showTerminalDrawer && (
          <div
            style={{
              height: "140px",
              background: "var(--bg-code)",
              padding: "8px 12px",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--ink-secondary)",
              overflowY: "auto",
              lineHeight: 1.5,
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ color: "var(--accent-teal)" }}>$ coreblow gateway :18789 [single-brain]</div>
            <div>[microkernel] SSE stream initialized</div>
            <div>[cory] cognitive memory synchronized (4 layers)</div>
            <div>[git] branch main verified against gates</div>
          </div>
        )}
      </div>
    </aside>
  );
};
