import React, { useState, useRef, useEffect } from "react";
import type { ActiveProjectState, RemoteNodeConfig } from "../types/gateway";
import { FolderIcon, GitBranchIcon, InspectorIcon, RefreshIcon, SettingsIcon } from "./Icons";

interface TopbarProps {
  sidebarCollapsed: boolean;
  project: ActiveProjectState;
  onChangeProject: (newPath: string) => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  gatewayHealthy: boolean;
  onReconnectGateway: () => void;
  nodes?: RemoteNodeConfig[];
  activeNodeId?: string;
  onSelectNode?: (nodeId: string) => void;
  onSyncSessions?: () => void;
  onOpenRemoteSettings?: () => void;
  isSyncingSessions?: boolean;
  layoutMode?: "basic" | "pro";
  onToggleLayoutMode?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  sidebarCollapsed,
  project,
  onChangeProject,
  inspectorOpen,
  onToggleInspector,
  gatewayHealthy,
  onReconnectGateway,
  nodes = [],
  activeNodeId = "local",
  onSelectNode,
  onSyncSessions,
  onOpenRemoteSettings,
  isSyncingSessions = false,
  layoutMode = "basic",
  onToggleLayoutMode,
}) => {
  const isMac = window.coreblowDesktop?.platform === "darwin";
  const paddingLeft = sidebarCollapsed ? (isMac ? "88px" : "12px") : "12px";
  const paddingRight = isMac ? "16px" : "148px";

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeNode = nodes.find((n) => n.id === activeNodeId) ?? {
    id: "local",
    name: "Local Gateway",
    url: "http://127.0.0.1:18789",
    kind: "local",
    enabled: true,
    healthy: gatewayHealthy,
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  const handleSelectFolder = async () => {
    if (window.coreblowDesktop) {
      const selected = await window.coreblowDesktop.dialog.selectDirectory();
      if (selected) {
        onChangeProject(selected);
      }
    }
  };

  const getPillLabel = () => {
    if (!gatewayHealthy) return "18789 Offline";
    if (activeNode.id === "local") return "Local :18789";
    const latency = activeNode.latencyMs ? ` · ${activeNode.latencyMs}ms` : "";
    return `${activeNode.name}${latency}`;
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
        position: "relative",
      }}
    >
      {/* Active Project & Git Branch Pill (⌘O) */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          type="button"
          onClick={handleSelectFolder}
          title={layoutMode === "basic" ? "Change active workspace folder (⌘O)" : "Change active project directory (⌘O)"}
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
          {layoutMode === "pro" && (
            <>
              <span style={{ color: "var(--border-strong)" }}>/</span>
              <GitBranchIcon size={12} color="var(--ink-secondary)" />
              <span style={{ color: "var(--ink-secondary)", maxWidth: "100px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {project.branch}
              </span>
            </>
          )}
        </button>
      </div>

      {/* Right Controls: Basic/Pro Toggle, Node Switcher Dropdown & Inspector Toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {/* 1-Click Basic / Pro Toggle Pill */}
        <button
          type="button"
          onClick={onToggleLayoutMode}
          title={`Active layout: ${layoutMode.toUpperCase()}. Click to switch to ${layoutMode === "basic" ? "Pro (Full 3-pane developer workspace)" : "Basic (Everyday clean chat & memory)"}`}
          style={{
            height: "26px",
            padding: "0 8px",
            borderRadius: "var(--radius-xs)",
            background: layoutMode === "basic" ? "rgba(45, 212, 191, 0.08)" : "rgba(255, 255, 255, 0.04)",
            border: layoutMode === "basic" ? "1px solid rgba(45, 212, 191, 0.3)" : "1px solid var(--border-subtle)",
            color: layoutMode === "basic" ? "var(--accent-teal)" : "var(--ink-secondary)",
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            transition: "all 0.15s ease",
          }}
        >
          <span style={{ fontSize: "10px" }}>{layoutMode === "basic" ? "⚡" : "🛠"}</span>
          <span>{layoutMode === "basic" ? "Basic" : "Pro"}</span>
        </button>
        {/* Interactive 1-Click Node Switcher Pill */}
        <div style={{ position: "relative" }} ref={dropdownRef}>
          <button
            type="button"
            onClick={() => {
              if (!gatewayHealthy) {
                onReconnectGateway();
              } else {
                setDropdownOpen(!dropdownOpen);
              }
            }}
            title={gatewayHealthy ? "Switch Gateway Node / Sync Sessions" : "Gateway disconnected. Click to reconnect."}
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
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.15s ease",
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
            <span style={{ maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {getPillLabel()}
            </span>
            {gatewayHealthy ? (
              <span style={{ fontSize: "9px", opacity: 0.7, marginLeft: "2px" }}>▼</span>
            ) : (
              <RefreshIcon size={11} />
            )}
          </button>

          {/* Node Switcher Dropdown Menu */}
          {dropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: "32px",
                right: 0,
                width: "280px",
                background: "var(--bg-input)",
                border: "1px solid var(--border-medium)",
                borderRadius: "var(--radius-md)",
                boxShadow: "0 12px 36px rgba(0, 0, 0, 0.55)",
                padding: "8px 0",
                zIndex: 1000,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  padding: "4px 12px 8px",
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: "var(--ink-muted)",
                  textTransform: "uppercase",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                Target Gateway Nodes (24/7)
              </div>

              {/* Node List */}
              <div style={{ maxHeight: "200px", overflowY: "auto", padding: "4px 0" }}>
                {nodes.map((node) => {
                  const isSelected = node.id === activeNodeId;
                  const isHealthy = node.healthy ?? gatewayHealthy;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => {
                        onSelectNode?.(node.id);
                        setDropdownOpen(false);
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        background: isSelected ? "var(--bg-chip)" : "transparent",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        color: "var(--ink-primary)",
                        transition: "background 0.1s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                        <span
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: isHealthy ? "var(--state-success)" : "var(--state-error)",
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                          <span style={{ fontSize: "12px", fontWeight: isSelected ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {node.name}
                          </span>
                          <span style={{ fontSize: "10px", color: "var(--ink-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {node.url}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                        <span
                          style={{
                            fontSize: "9px",
                            padding: "1px 5px",
                            borderRadius: "var(--radius-xs)",
                            background: "rgba(45, 212, 191, 0.1)",
                            color: "var(--accent-teal)",
                            textTransform: "uppercase",
                          }}
                        >
                          {node.kind}
                        </span>
                        {node.latencyMs !== undefined && node.latencyMs > 0 && (
                          <span style={{ fontSize: "10px", color: "var(--ink-secondary)", fontFamily: "var(--font-mono)" }}>
                            {node.latencyMs}ms
                          </span>
                        )}
                        {isSelected && (
                          <span style={{ color: "var(--accent-teal)", fontSize: "12px", fontWeight: 700 }}>✓</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  borderTop: "1px solid var(--border-subtle)",
                  padding: "6px 8px 2px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSyncSessions?.();
                    setDropdownOpen(false);
                  }}
                  disabled={isSyncingSessions}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    width: "100%",
                    padding: "6px 8px",
                    background: "transparent",
                    border: "none",
                    borderRadius: "var(--radius-xs)",
                    color: "var(--accent-teal)",
                    fontSize: "11px",
                    fontWeight: 500,
                    cursor: isSyncingSessions ? "wait" : "pointer",
                    textAlign: "left",
                  }}
                >
                  <RefreshIcon size={12} />
                  <span>{isSyncingSessions ? "Syncing Sessions..." : "Sync Sessions with Node"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onOpenRemoteSettings?.();
                    setDropdownOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    width: "100%",
                    padding: "6px 8px",
                    background: "transparent",
                    border: "none",
                    borderRadius: "var(--radius-xs)",
                    color: "var(--ink-secondary)",
                    fontSize: "11px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <SettingsIcon size={12} />
                  <span>Manage 24/7 Remote Nodes...</span>
                </button>
              </div>
            </div>
          )}
        </div>

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
