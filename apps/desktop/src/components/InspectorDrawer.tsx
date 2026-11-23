import React, { useState } from "react";
import type { ActiveProjectState } from "../types/gateway";
import { GitGatesTab } from "./tabs/GitGatesTab";
import { WarRoomTab } from "./tabs/WarRoomTab";
import { MemoryWikiTab } from "./tabs/MemoryWikiTab";
import { CoreHubTab } from "./tabs/CoreHubTab";
import { WorkspaceFilesTab } from "./tabs/WorkspaceFilesTab";
import { LocalTerminalTab } from "./tabs/LocalTerminalTab";
import {
  AgentsBrainIcon,
  CompassIcon,
  CoreHubIcon,
  ExpandPaneIcon,
  FolderIcon,
  GitBranchIcon,
  GlobeIcon,
  GridToolsIcon,
  InspectorIcon,
  MemoryBrainIcon,
  RefreshIcon,
  SplitPaneIcon,
  TerminalIcon,
} from "./Icons";

export type InspectorTab =
  | "start"
  | "files"
  | "terminal"
  | "browser"
  | "git"
  | "warroom"
  | "memory"
  | "corehub";

interface InspectorDrawerProps {
  open: boolean;
  onClose: () => void;
  activeTab: InspectorTab;
  onChangeTab: (tab: InspectorTab) => void;
  project: ActiveProjectState;
  onAttachFile?: (path: string) => void;
}

export const InspectorDrawer: React.FC<InspectorDrawerProps> = ({
  open,
  onClose,
  activeTab,
  onChangeTab,
  project,
  onAttachFile,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [moreToolsOpen, setMoreToolsOpen] = useState(false);
  const [browserUrl, setBrowserUrl] = useState("http://127.0.0.1:9119");

  if (!open) return null;

  const handleNavigateBrowser = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!browserUrl.trim()) return;
    let url = browserUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    setBrowserUrl(url);
  };

  const handleOpenExternal = () => {
    if (!browserUrl) return;
    window.open(browserUrl, "_blank", "noopener,noreferrer");
  };

  const getTitle = () => {
    switch (activeTab) {
      case "files":
        return "Workspace files";
      case "git":
        return "Git Gates";
      case "terminal":
        return "Terminal";
      case "browser":
        return "Browser";
      case "warroom":
        return "Agent Squad";
      case "memory":
        return "Cory Memory";
      case "corehub":
        return "CoreHub Capabilities";
      default:
        return "Start";
    }
  };

  return (
    <aside
      style={{
        width: isExpanded ? "min(620px, 56vw)" : "min(440px, 40vw)",
        height: "100%",
        background: "var(--bg-sidebar)",
        borderLeft: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        flexShrink: 0,
        zIndex: 10,
        overflow: "hidden",
        transition: "width 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* Top 44px Header (horizontally aligned with Topbar) */}
      <div
        data-window-drag
        style={{
          height: "var(--topbar-height, 44px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          borderBottom: "1px solid var(--border-subtle)",
          boxSizing: "border-box",
          flexShrink: 0,
        }}
      >
        {/* Left: Start Home or ‹ Start back link + active view title */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {activeTab === "start" ? (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <CompassIcon size={14} color="var(--ink-secondary)" />
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-primary)" }}>
                Start
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                type="button"
                onClick={() => onChangeTab("start")}
                title="Return to Start Launcher"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--accent-teal)",
                  fontSize: "12.5px",
                  fontWeight: 500,
                  cursor: "pointer",
                  padding: "2px 4px",
                  borderRadius: "var(--radius-xs)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "2px",
                }}
              >
                ‹ Start
              </button>
              <span style={{ color: "var(--border-strong)", fontSize: "11px" }}>/</span>
              <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ink-primary)" }}>
                {getTitle()}
              </span>
            </div>
          )}
        </div>

        {/* Right: 3 clean monochrome hairline buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {/* 1. Split / Start Home toggle */}
          <button
            type="button"
            onClick={() => onChangeTab("start")}
            title="Start Launcher Home"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "var(--radius-sm)",
              background: activeTab === "start" ? "var(--bg-chip)" : "transparent",
              border: "none",
              color: activeTab === "start" ? "var(--ink-primary)" : "var(--ink-secondary)",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              transition: "all 0.12s ease",
            }}
          >
            <SplitPaneIcon size={14} />
          </button>

          {/* 2. Expand / Collapse pane width toggle */}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            title={isExpanded ? "Collapse Pane Width" : "Expand Pane Width"}
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "var(--radius-sm)",
              background: isExpanded ? "var(--bg-chip)" : "transparent",
              border: "none",
              color: isExpanded ? "var(--accent-teal)" : "var(--ink-secondary)",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              transition: "all 0.12s ease",
            }}
          >
            <ExpandPaneIcon size={14} />
          </button>

          {/* 3. Close Workspace Panel */}
          <button
            type="button"
            onClick={onClose}
            title="Close Workspace Panel (⌘I)"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "var(--radius-sm)",
              background: "transparent",
              border: "none",
              color: "var(--ink-secondary)",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              transition: "all 0.12s ease",
            }}
          >
            <InspectorIcon size={14} />
          </button>
        </div>
      </div>

      {/* Main Panel Content */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {activeTab === "start" ? (
          /* Start Launcher Home View */
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px 20px",
              boxSizing: "border-box",
            }}
          >
            {/* Subtle compass watermark */}
            <div
              style={{
                marginBottom: "20px",
                display: "grid",
                placeItems: "center",
                opacity: 0.22,
                color: "var(--ink-secondary)",
              }}
            >
              <CompassIcon size={44} />
            </div>

            {/* 4 Tactile Rounded Hairline Action Cards */}
            <div
              style={{
                maxWidth: "340px",
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              {/* Card 1: Workspace files */}
              <button
                type="button"
                onClick={() => onChangeTab("files")}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-card-hover)";
                  e.currentTarget.style.borderColor = "var(--border-medium)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--bg-card)";
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                  <FolderIcon size={16} color="var(--accent-teal)" />
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--ink-primary)" }}>
                      Workspace files
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
                      Browse files in this session's workspace
                    </span>
                  </div>
                </div>
                <kbd
                  style={{
                    fontSize: "10px",
                    padding: "2px 5px",
                    borderRadius: "4px",
                    background: "var(--kbd-bg)",
                    color: "var(--ink-muted)",
                    border: "1px solid var(--border-subtle)",
                    fontFamily: "var(--font-mono)",
                    flexShrink: 0,
                  }}
                >
                  ⌘P
                </kbd>
              </button>

              {/* Card 2: New terminal ▾ */}
              <button
                type="button"
                onClick={() => onChangeTab("terminal")}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-card-hover)";
                  e.currentTarget.style.borderColor = "var(--border-medium)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--bg-card)";
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                  <TerminalIcon size={16} color="var(--accent-teal)" />
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--ink-primary)" }}>
                      New terminal ▾
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
                      Run commands in the Session workspace
                    </span>
                  </div>
                </div>
                <kbd
                  style={{
                    fontSize: "10px",
                    padding: "2px 5px",
                    borderRadius: "4px",
                    background: "var(--kbd-bg)",
                    color: "var(--ink-muted)",
                    border: "1px solid var(--border-subtle)",
                    fontFamily: "var(--font-mono)",
                    flexShrink: 0,
                  }}
                >
                  ⌃`
                </kbd>
              </button>

              {/* Card 3: Browser */}
              <button
                type="button"
                onClick={() => onChangeTab("browser")}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-card-hover)";
                  e.currentTarget.style.borderColor = "var(--border-medium)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--bg-card)";
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                  <GlobeIcon size={16} color="var(--accent-teal)" />
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--ink-primary)" }}>
                      Browser
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
                      Browse web pages
                    </span>
                  </div>
                </div>
                <kbd
                  style={{
                    fontSize: "10px",
                    padding: "2px 5px",
                    borderRadius: "4px",
                    background: "var(--kbd-bg)",
                    color: "var(--ink-muted)",
                    border: "1px solid var(--border-subtle)",
                    fontFamily: "var(--font-mono)",
                    flexShrink: 0,
                  }}
                >
                  ⌘T
                </kbd>
              </button>

              {/* Card 4: More tools */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => setMoreToolsOpen((prev) => !prev)}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    borderRadius: "12px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--bg-card-hover)";
                    e.currentTarget.style.borderColor = "var(--border-medium)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--bg-card)";
                    e.currentTarget.style.borderColor = "var(--border-subtle)";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <GridToolsIcon size={16} color="var(--ink-secondary)" />
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--ink-primary)" }}>
                      More tools
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
                    {moreToolsOpen ? "▴" : "▾"}
                  </span>
                </button>

                {/* Expanded More Tools Matrix */}
                {moreToolsOpen && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "6px",
                      padding: "4px 0",
                    }}
                  >
                    {[
                      {
                        id: "git" as const,
                        label: "Git Gates",
                        icon: <GitBranchIcon size={13} color="var(--accent-teal)" />,
                      },
                      {
                        id: "warroom" as const,
                        label: "Agent Squad",
                        icon: <AgentsBrainIcon size={13} color="var(--accent-teal)" />,
                      },
                      {
                        id: "memory" as const,
                        label: "Cory Memory",
                        icon: <MemoryBrainIcon size={13} color="var(--accent-teal)" />,
                      },
                      {
                        id: "corehub" as const,
                        label: "CoreHub",
                        icon: <CoreHubIcon size={13} color="var(--accent-teal)" />,
                      },
                    ].map((tool) => (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => onChangeTab(tool.id)}
                        style={{
                          padding: "10px 12px",
                          borderRadius: "8px",
                          background: "var(--bg-card)",
                          border: "1px solid var(--border-subtle)",
                          color: "var(--ink-primary)",
                          fontSize: "12px",
                          fontWeight: 500,
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          cursor: "pointer",
                          transition: "all 0.12s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "var(--bg-card-hover)";
                          e.currentTarget.style.borderColor = "var(--accent-teal)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "var(--bg-card)";
                          e.currentTarget.style.borderColor = "var(--border-subtle)";
                        }}
                      >
                        {tool.icon}
                        <span>{tool.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === "files" ? (
          <WorkspaceFilesTab project={project} onAttachFile={onAttachFile} />
        ) : activeTab === "git" ? (
          <div style={{ flex: 1, padding: "14px" }}>
            <GitGatesTab branch={project.branch} uncommittedFiles={project.uncommittedFiles} />
          </div>
        ) : activeTab === "terminal" ? (
          <LocalTerminalTab project={project} />
        ) : activeTab === "browser" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {/* Browser Address Bar */}
            <form
              onSubmit={handleNavigateBrowser}
              style={{
                height: "36px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "0 10px",
                background: "var(--bg-card)",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              <GlobeIcon size={13} color="var(--accent-teal)" />
              <input
                type="text"
                value={browserUrl}
                onChange={(e) => setBrowserUrl(e.target.value)}
                placeholder="Enter URL (e.g. localhost:9119)..."
                style={{
                  flex: 1,
                  height: "24px",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "4px",
                  padding: "0 8px",
                  color: "var(--ink-primary)",
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                title="Navigate to URL"
                style={{
                  height: "24px",
                  padding: "0 8px",
                  borderRadius: "4px",
                  background: "var(--accent-teal-subtle)",
                  border: "1px solid var(--accent-teal)",
                  color: "var(--accent-teal)",
                  fontSize: "10px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Go
              </button>
              <button
                type="button"
                onClick={() => {
                  const curr = browserUrl;
                  setBrowserUrl("");
                  setTimeout(() => setBrowserUrl(curr), 50);
                }}
                title="Reload"
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "4px",
                  background: "transparent",
                  border: "none",
                  color: "var(--ink-secondary)",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
              >
                <RefreshIcon size={12} />
              </button>
              <button
                type="button"
                onClick={handleOpenExternal}
                title="Open in External Browser"
                style={{
                  height: "24px",
                  padding: "0 6px",
                  borderRadius: "4px",
                  background: "transparent",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--ink-muted)",
                  fontSize: "10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                  cursor: "pointer",
                }}
              >
                <span>↗</span>
              </button>
            </form>

            {/* Browser View */}
            <div style={{ flex: 1, position: "relative", background: "var(--bg-canvas)" }}>
              {browserUrl ? (
                <iframe
                  src={browserUrl}
                  title="CoreBlow Embedded Browser"
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    background: "#FFFFFF",
                  }}
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                />
              ) : (
                <div
                  style={{
                    padding: "24px",
                    textAlign: "center",
                    color: "var(--ink-muted)",
                    fontSize: "12px",
                  }}
                >
                  No URL loaded
                </div>
              )}
            </div>
          </div>
        ) : activeTab === "warroom" ? (
          <div style={{ flex: 1, padding: "14px" }}>
            <WarRoomTab />
          </div>
        ) : activeTab === "memory" ? (
          <div style={{ flex: 1, padding: "14px" }}>
            <MemoryWikiTab />
          </div>
        ) : activeTab === "corehub" ? (
          <div style={{ flex: 1, padding: "14px" }}>
            <CoreHubTab />
          </div>
        ) : null}
      </div>
    </aside>
  );
};
