import React, { useState, useEffect, useRef } from "react";
import type { ChatThread, DesktopAgent, AgentSection } from "../types/gateway";
import {
  AgentsBrainIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  CoreBlowEmblem,
  FolderIcon,
  FolderPlusIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SidebarToggleIcon,
  SkillsChipIcon,
  TrashIcon,
  UsersIcon,
  VolumeXIcon,
} from "./Icons";
import { AgentContextMenu } from "./AgentContextMenu";

export interface SidebarProps {
  threads: ChatThread[];
  activeThreadId: string | null;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onDeleteThread: (id: string) => void;
  onTogglePinThread?: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSettings: (section?: string) => void;
  onOpenTab?: (tab: "git" | "warroom" | "memory" | "corehub") => void;
  activeMode?: "sessions" | "agent";
  onChangeMode?: (mode: "sessions" | "agent") => void;
  agents?: DesktopAgent[];
  activeAgentId?: string | null;
  onSelectAgent?: (id: string) => void;
  onCreateAgent?: (name: string) => void;
  onCreateAgentModal?: () => void;
  onCreateGroupChatModal?: () => void;
  onCreateSectionModal?: () => void;
  onToggleMuteAgent?: (id: string) => void;
  onDeleteAgent?: (id: string) => void;
  onEditAgent?: (agent: DesktopAgent) => void;
  onManageGroups?: (agent: DesktopAgent) => void;
  onDuplicateAgent?: (agent: DesktopAgent) => void;
  onTogglePinAgent?: (agent: DesktopAgent) => void;
  onToggleHideAgent?: (agent: DesktopAgent) => void;
  onToggleAutoOpenScreen?: (agent: DesktopAgent) => void;
  onOpenAgentChatInNewTab?: (agent: DesktopAgent) => void;
  onOpenScreen?: (agent: DesktopAgent) => void;
  onNewChatWithAgent?: (agent: DesktopAgent) => void;
  onOpenRecentSession?: (agent: DesktopAgent) => void;
  onMoveToSection?: (agent: DesktopAgent, sectionId: string | null) => void;
  agentSections?: AgentSection[];
  onToggleSectionCollapse?: (sectionId: string) => void;
}

const DEFAULT_FALLBACK_AGENT: DesktopAgent = {
  id: "agent_coreblow",
  name: "CoreBlow",
  tagline: "Say something to get started.",
  accentColor: "#2DD4BF",
  updatedAt: Date.now(),
  messages: [],
};

function formatRelativeTime(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return "now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return `${Math.floor(diffHr / 24)}d`;
}

export const Sidebar: React.FC<SidebarProps> = ({
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  onTogglePinThread,
  collapsed,
  onToggleCollapse,
  onOpenSettings,
  onOpenTab,
  activeMode,
  onChangeMode,
  agents,
  activeAgentId,
  onSelectAgent,
  onCreateAgent,
  onCreateAgentModal,
  onCreateGroupChatModal,
  onCreateSectionModal,
  onToggleMuteAgent,
  onDeleteAgent,
  onEditAgent,
  onManageGroups,
  onDuplicateAgent,
  onTogglePinAgent,
  onToggleHideAgent,
  onToggleAutoOpenScreen,
  onOpenAgentChatInNewTab,
  onOpenScreen,
  onNewChatWithAgent,
  onOpenRecentSession,
  onMoveToSection,
  agentSections = [],
  onToggleSectionCollapse,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [internalMode, setInternalMode] = useState<"sessions" | "agent">("sessions");
  const [hoveredThreadId, setHoveredThreadId] = useState<string | null>(null);
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [muteAllAgents, setMuteAllAgents] = useState(false);
  const [plusDropdownOpen, setPlusDropdownOpen] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [contextMenuState, setContextMenuState] = useState<{
    agent: DesktopAgent;
    position: { x: number; y: number };
  } | null>(null);

  const plusDropdownRef = useRef<HTMLDivElement>(null);
  const isMac = window.coreblowDesktop?.platform === "darwin";

  const currentMode = activeMode ?? internalMode;
  const agentList = agents && agents.length > 0 ? agents : [DEFAULT_FALLBACK_AGENT];
  const currentAgentId = activeAgentId ?? agentList[0]?.id ?? "agent_coreblow";

  const hiddenCount = agentList.filter((a) => a.hidden).length;
  const visibleAgents = agentList.filter((a) => showHidden || !a.hidden);
  const sortedAgents = [...visibleAgents].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.updatedAt - a.updatedAt;
  });

  const filteredThreads = threads.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Close plus dropdown on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (plusDropdownRef.current && !plusDropdownRef.current.contains(e.target as Node)) {
        setPlusDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlusDropdownOpen(false);
    };

    if (plusDropdownOpen) {
      window.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [plusDropdownOpen]);

  const handleAgentClick = () => {
    setInternalMode("agent");
    onChangeMode?.("agent");
  };

  const handleSessionsClick = () => {
    setInternalMode("sessions");
    onChangeMode?.("sessions");
  };

  const handleSubmitNewAgent = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newAgentName.trim();
    if (!trimmed) return;
    onCreateAgent?.(trimmed);
    setNewAgentName("");
    setCreatingAgent(false);
  };

  if (collapsed) {
    return (
      <aside
        style={{
          width: "var(--sidebar-collapsed, 56px)",
          height: "100%",
          background: "var(--bg-sidebar)",
          borderRight: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: isMac ? "44px 0 16px" : "12px 0 16px",
          boxSizing: "border-box",
          flexShrink: 0,
          gap: "12px",
        }}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Expand sidebar"
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "var(--radius-sm)",
            background: "transparent",
            border: "none",
            color: "var(--ink-secondary)",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
          }}
        >
          <SidebarToggleIcon size={18} />
        </button>

        <button
          type="button"
          onClick={onNewThread}
          title="New Chat (⌘N)"
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "var(--radius-sm)",
            background: "var(--bg-chip)",
            border: "1px solid var(--border-subtle)",
            color: "var(--accent-teal)",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
          }}
        >
          <PlusIcon size={18} />
        </button>

        <button
          type="button"
          onClick={() => onOpenTab?.("corehub")}
          title="Capabilities"
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "var(--radius-sm)",
            background: "transparent",
            border: "none",
            color: "var(--accent-teal)",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
          }}
        >
          <SkillsChipIcon size={18} color="var(--accent-teal)" />
        </button>

        <button
          type="button"
          onClick={() => onOpenSettings("automations")}
          title="Scheduled jobs"
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "var(--radius-sm)",
            background: "transparent",
            border: "none",
            color: "var(--accent-teal)",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
          }}
        >
          <ClockIcon size={18} color="var(--accent-teal)" />
        </button>

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={() => onOpenSettings()}
          title="Settings (⌘,)"
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "var(--radius-sm)",
            background: "transparent",
            border: "none",
            color: "var(--ink-secondary)",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
          }}
        >
          <SettingsIcon size={18} />
        </button>
      </aside>
    );
  }

  return (
    <aside
      style={{
        width: "var(--sidebar-default, 260px)",
        height: "100%",
        background: "var(--bg-sidebar)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        padding: "0 10px 12px",
        boxSizing: "border-box",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {/* Top window clearance & branding (44px height, horizontally aligned with Topbar) */}
      <div
        data-window-drag
        style={{
          height: "44px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: isMac ? "0 4px 0 72px" : "0 4px 0 12px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "12.5px", fontWeight: 700, letterSpacing: "0.05em", color: "var(--ink-primary)" }}>
            COREBLOW
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          title="Collapse sidebar"
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
          <SidebarToggleIcon size={16} />
        </button>
      </div>

      {/* Top Segmented Switcher: SESSIONS | AGENT */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "4px",
          background: "var(--bg-chip)",
          padding: "3px",
          borderRadius: "8px",
          margin: "4px 0 10px",
        }}
      >
        <button
          type="button"
          onClick={handleSessionsClick}
          style={{
            background: currentMode === "sessions" ? "var(--bg-card)" : "transparent",
            color: currentMode === "sessions" ? "var(--accent-teal)" : "var(--ink-muted)",
            border: "none",
            borderRadius: "6px",
            padding: "5px 0",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.05em",
            cursor: "pointer",
            transition: "all 0.12s ease",
            textAlign: "center",
          }}
        >
          SESSIONS
        </button>
        <button
          type="button"
          onClick={handleAgentClick}
          style={{
            background: currentMode === "agent" ? "var(--bg-card)" : "transparent",
            color: currentMode === "agent" ? "var(--accent-teal)" : "var(--ink-muted)",
            border: "none",
            borderRadius: "6px",
            padding: "5px 0",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.05em",
            cursor: "pointer",
            transition: "all 0.12s ease",
            textAlign: "center",
          }}
        >
          AGENT
        </button>
      </div>

      {currentMode === "agent" ? (
        /* Dedicated AGENT Sidebar Mode */
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* AGENTS Header Row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 6px 8px",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  fontSize: "10.5px",
                  fontWeight: 700,
                  letterSpacing: "0.07em",
                  color: "var(--ink-muted)",
                  textTransform: "uppercase",
                }}
              >
                AGENTS
              </span>
              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHidden((prev) => !prev)}
                  title={showHidden ? "Hide hidden agents" : "Show hidden agents"}
                  style={{
                    background: showHidden ? "var(--bg-chip)" : "transparent",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-full)",
                    padding: "1px 6px",
                    fontSize: "9.5px",
                    color: showHidden ? "var(--accent-teal)" : "var(--ink-muted)",
                    cursor: "pointer",
                  }}
                >
                  Hidden ({hiddenCount})
                </button>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "4px", position: "relative" }}>
              <button
                type="button"
                onClick={() => {
                  setMuteAllAgents((m) => !m);
                  onToggleMuteAgent?.(currentAgentId);
                }}
                title={muteAllAgents ? "Unmute agent alerts" : "Mute agent alerts"}
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "var(--radius-xs)",
                  background: "transparent",
                  border: "none",
                  color: muteAllAgents ? "var(--accent-teal)" : "var(--ink-muted)",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
              >
                <VolumeXIcon size={13} />
              </button>
              <button
                type="button"
                onClick={() => setPlusDropdownOpen((prev) => !prev)}
                title="Create new agent or group"
                aria-label="Create new agent"
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "var(--radius-xs)",
                  background: plusDropdownOpen ? "var(--bg-chip)" : "transparent",
                  border: "none",
                  color: plusDropdownOpen ? "var(--accent-teal)" : "var(--ink-muted)",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
              >
                <PlusIcon size={14} />
              </button>

              {/* "+" Dropdown Popover */}
              {plusDropdownOpen && (
                <div
                  ref={plusDropdownRef}
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: "4px",
                    minWidth: "165px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-medium)",
                    borderRadius: "var(--radius-md)",
                    padding: "4px",
                    boxShadow: "var(--shadow-composer)",
                    zIndex: 9999,
                    backdropFilter: "blur(16px)",
                    fontFamily: "var(--font-ui)",
                  }}
                >
                  <div
                    onClick={() => {
                      setPlusDropdownOpen(false);
                      if (onCreateAgentModal) onCreateAgentModal();
                      else setCreatingAgent(true);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "6px 8px",
                      borderRadius: "var(--radius-xs)",
                      fontSize: "12px",
                      color: "var(--ink-primary)",
                      cursor: "pointer",
                      transition: "background 0.1s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <AgentsBrainIcon size={13} color="var(--accent-teal)" />
                    <span>New agent</span>
                  </div>

                  <div
                    onClick={() => {
                      setPlusDropdownOpen(false);
                      onCreateGroupChatModal?.();
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "6px 8px",
                      borderRadius: "var(--radius-xs)",
                      fontSize: "12px",
                      color: "var(--ink-primary)",
                      cursor: "pointer",
                      transition: "background 0.1s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <UsersIcon size={13} color="var(--ink-secondary)" />
                    <span>New group chat</span>
                  </div>

                  <div style={{ height: "1px", background: "var(--border-subtle)", margin: "4px 0" }} />

                  <div
                    onClick={() => {
                      setPlusDropdownOpen(false);
                      onCreateSectionModal?.();
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "6px 8px",
                      borderRadius: "var(--radius-xs)",
                      fontSize: "12px",
                      color: "var(--ink-primary)",
                      cursor: "pointer",
                      transition: "background 0.1s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <FolderPlusIcon size={13} color="var(--ink-secondary)" />
                    <span>New section</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Inline New Agent Form (Legacy / Fast-add fallback) */}
          {creatingAgent && (
            <form
              onSubmit={handleSubmitNewAgent}
              style={{
                display: "flex",
                gap: "6px",
                marginBottom: "8px",
                padding: "0 2px",
              }}
            >
              <input
                type="text"
                autoFocus
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setCreatingAgent(false);
                    setNewAgentName("");
                  }
                }}
                placeholder="Agent name..."
                style={{
                  flex: 1,
                  height: "28px",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-medium)",
                  borderRadius: "var(--radius-xs)",
                  padding: "0 8px",
                  color: "var(--ink-primary)",
                  fontSize: "12px",
                  outline: "none",
                  minWidth: 0,
                }}
              />
              <button
                type="submit"
                style={{
                  height: "28px",
                  padding: "0 10px",
                  background: "var(--accent-teal)",
                  color: "#08110F",
                  border: "none",
                  borderRadius: "var(--radius-xs)",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                Add
              </button>
            </form>
          )}

          {/* Persistent Agent List */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            {(() => {
              const renderAgentItem = (agent: DesktopAgent) => {
                const isActive = agent.id === currentAgentId;
                const isHovered = hoveredAgentId === agent.id;
                const canDelete = agent.id !== "agent_coreblow" && Boolean(onDeleteAgent);
                return (
                  <div
                    key={agent.id}
                    onClick={() => onSelectAgent?.(agent.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextMenuState({
                        agent,
                        position: { x: e.clientX, y: e.clientY },
                      });
                    }}
                    onMouseEnter={() => setHoveredAgentId(agent.id)}
                    onMouseLeave={() => setHoveredAgentId(null)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      borderRadius: "var(--radius-sm)",
                      background: isActive ? "var(--bg-chip)" : isHovered ? "var(--bg-hover)" : "transparent",
                      border: isActive ? "1px solid var(--border-medium)" : "1px solid transparent",
                      cursor: "pointer",
                      transition: "background 0.12s ease, border-color 0.12s ease",
                      userSelect: "none",
                      opacity: agent.hidden ? 0.6 : 1,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      <div
                        style={{
                          width: "26px",
                          height: "26px",
                          borderRadius: "7px",
                          background: `${agent.accentColor}22`,
                          border: `1px solid ${agent.accentColor}55`,
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        <CoreBlowEmblem size={15} color={agent.accentColor} />
                      </div>
                      <span
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          border: `1.5px solid ${isActive ? "var(--accent-teal)" : "var(--ink-muted)"}`,
                          background: isActive ? "var(--accent-teal)" : "transparent",
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: isActive ? 600 : 500,
                          color: isActive ? "var(--ink-primary)" : "var(--ink-secondary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {agent.name}
                      </span>
                      {agent.pinned && <PinIcon size={11} color="var(--accent-teal)" />}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                      {canDelete && isHovered ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteAgent?.(agent.id);
                          }}
                          title="Delete agent"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--ink-muted)",
                            cursor: "pointer",
                            padding: "2px",
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          <TrashIcon size={11} />
                        </button>
                      ) : (
                        <span
                          style={{
                            fontSize: "11px",
                            color: "var(--ink-muted)",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {formatRelativeTime(agent.updatedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              };

              if (agentSections && agentSections.length > 0) {
                const unassignedAgents = sortedAgents.filter(
                  (a) => !a.sectionId || !agentSections.some((s) => s.id === a.sectionId),
                );

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {agentSections.map((sec) => {
                      const secAgents = sortedAgents.filter((a) => a.sectionId === sec.id);
                      return (
                        <div key={sec.id} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          {/* Section Header */}
                          <div
                            onClick={() => onToggleSectionCollapse?.(sec.id)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "4px 6px",
                              cursor: "pointer",
                              userSelect: "none",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontSize: "10px", color: "var(--ink-muted)" }}>
                                {sec.collapsed ? "▸" : "▾"}
                              </span>
                              <FolderIcon size={12} color="var(--ink-muted)" />
                              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink-muted)" }}>
                                {sec.name}
                              </span>
                            </div>
                            <span style={{ fontSize: "10px", color: "var(--ink-muted)" }}>
                              {secAgents.length}
                            </span>
                          </div>

                          {/* Section Agents */}
                          {!sec.collapsed && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px", paddingLeft: "4px" }}>
                              {secAgents.length === 0 ? (
                                <div style={{ padding: "4px 10px", fontSize: "11px", color: "var(--ink-muted)", fontStyle: "italic" }}>
                                  Empty section
                                </div>
                              ) : (
                                secAgents.map(renderAgentItem)
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {unassignedAgents.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <div style={{ padding: "4px 6px", fontSize: "10.5px", fontWeight: 600, color: "var(--ink-muted)", textTransform: "uppercase" }}>
                          Unassigned
                        </div>
                        {unassignedAgents.map(renderAgentItem)}
                      </div>
                    )}
                  </div>
                );
              }

              return sortedAgents.map(renderAgentItem);
            })()}
          </div>
        </div>
      ) : (
        /* Regular SESSIONS Sidebar Mode */
        <>
          {/* Primary Action Button: + New Chat */}
          <div style={{ marginBottom: "8px" }}>
            <button
              type="button"
              onClick={onNewThread}
              style={{
                width: "100%",
                height: "36px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 12px",
                background: "var(--bg-chip)",
                border: "1px solid var(--border-medium)",
                borderRadius: "var(--radius-sm)",
                color: "var(--ink-primary)",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <PlusIcon size={15} color="var(--accent-teal)" />
                New Chat
              </span>
              <kbd
                style={{
                  fontSize: "10px",
                  padding: "1px 4px",
                  borderRadius: "3px",
                  background: "var(--kbd-bg)",
                  color: "var(--ink-muted)",
                  border: "1px solid var(--border-subtle)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                ⌘N
              </kbd>
            </button>
          </div>

          {/* Quick Navigation Links: EXACTLY 2 clean hairline items */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              marginBottom: "10px",
            }}
          >
            <button
              type="button"
              onClick={() => onOpenTab?.("corehub")}
              title="Skills & Storefront Marketplace"
              style={{
                height: "32px",
                padding: "0 10px",
                borderRadius: "8px",
                background: "transparent",
                border: "1px solid var(--border-subtle)",
                color: "var(--ink-secondary)",
                fontSize: "12.5px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.12s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--bg-hover)";
                e.currentTarget.style.color = "var(--ink-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--ink-secondary)";
              }}
            >
              <SkillsChipIcon size={14} color="var(--accent-teal)" />
              <span>Capabilities</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenSettings("automations")}
              title="Scheduled Automations & Background Tasks"
              style={{
                height: "32px",
                padding: "0 10px",
                borderRadius: "8px",
                background: "transparent",
                border: "1px solid var(--border-subtle)",
                color: "var(--ink-secondary)",
                fontSize: "12.5px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.12s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--bg-hover)";
                e.currentTarget.style.color = "var(--ink-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--ink-secondary)";
              }}
            >
              <ClockIcon size={14} color="var(--accent-teal)" />
              <span>Scheduled jobs</span>
            </button>
          </div>

          {/* Search Bar (Clean 30px input) */}
          <div style={{ position: "relative", marginBottom: "8px" }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              style={{
                width: "100%",
                height: "30px",
                background: "var(--bg-input)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-xs)",
                padding: "0 8px 0 28px",
                color: "var(--ink-primary)",
                fontSize: "12px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <span
              style={{
                position: "absolute",
                left: "8px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--ink-muted)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <SearchIcon size={13} />
            </span>
          </div>

          {/* Conversation List (Pinned & Recent threads with hover-only actions) */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              margin: "4px 0",
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >
            {filteredThreads.length === 0 ? (
              <div
                style={{
                  padding: "24px 12px",
                  textAlign: "center",
                  color: "var(--ink-muted)",
                  fontSize: "12px",
                }}
              >
                {searchQuery ? "No matching conversations" : "No recent conversations"}
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isActive = thread.id === activeThreadId;
                const isHovered = hoveredThreadId === thread.id;
                const showActions = isHovered || thread.pinned;
                return (
                  <div
                    key={thread.id}
                    onClick={() => onSelectThread(thread.id)}
                    onMouseEnter={() => setHoveredThreadId(thread.id)}
                    onMouseLeave={() => setHoveredThreadId(null)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "7px 10px",
                      borderRadius: "var(--radius-sm)",
                      background: isActive ? "var(--bg-chip)" : "transparent",
                      border: isActive ? "1px solid var(--border-medium)" : "1px solid transparent",
                      color: isActive ? "var(--ink-primary)" : "var(--ink-secondary)",
                      cursor: "pointer",
                      fontSize: "13px",
                      transition: "background 0.12s ease",
                      userSelect: "none",
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "180px",
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      {thread.title}
                    </span>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        opacity: showActions ? 1 : 0,
                        transition: "opacity 0.12s ease",
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePinThread?.(thread.id);
                        }}
                        title={thread.pinned ? "Unpin conversation" : "Pin conversation"}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: thread.pinned ? "var(--accent-teal)" : "var(--ink-muted)",
                          cursor: "pointer",
                          padding: "2px",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <PinIcon size={11} color={thread.pinned ? "var(--accent-teal)" : "currentColor"} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteThread(thread.id);
                        }}
                        title="Delete conversation"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--ink-muted)",
                          cursor: "pointer",
                          padding: "2px",
                          display: isHovered ? "grid" : "none",
                          placeItems: "center",
                        }}
                      >
                        <TrashIcon size={11} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Bottom Footer: Settings with ⌘, */}
      <div
        style={{
          paddingTop: "8px",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <button
          type="button"
          onClick={() => onOpenSettings()}
          style={{
            width: "100%",
            height: "38px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 10px",
            background: "transparent",
            border: "1px solid transparent",
            borderRadius: "var(--radius-sm)",
            color: "var(--ink-secondary)",
            fontSize: "13px",
            cursor: "pointer",
            transition: "all 0.12s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-hover)";
            e.currentTarget.style.color = "var(--ink-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--ink-secondary)";
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <SettingsIcon size={15} />
            Settings
          </span>
          <kbd
            style={{
              fontSize: "10px",
              padding: "1px 4px",
              borderRadius: "3px",
              background: "var(--kbd-bg)",
              color: "var(--ink-muted)",
              border: "1px solid var(--border-subtle)",
              fontFamily: "var(--font-mono)",
            }}
          >
            ⌘,
          </kbd>
        </button>
      </div>

      {contextMenuState && (
        <AgentContextMenu
          agent={contextMenuState.agent}
          position={contextMenuState.position}
          sections={agentSections}
          onClose={() => setContextMenuState(null)}
          onOpenChat={(ag) => {
            onSelectAgent?.(ag.id);
            if (activeMode !== "agent") onChangeMode?.("agent");
          }}
          onOpenChatInNewTab={(ag) => onOpenAgentChatInNewTab?.(ag)}
          onOpenScreen={(ag) => onOpenScreen?.(ag)}
          onToggleAutoOpenScreen={(ag) => onToggleAutoOpenScreen?.(ag)}
          onTogglePin={(ag) => onTogglePinAgent?.(ag)}
          onToggleHide={(ag) => onToggleHideAgent?.(ag)}
          onEdit={(ag) => onEditAgent?.(ag)}
          onManageGroups={(ag) => onManageGroups?.(ag)}
          onDuplicate={(ag) => onDuplicateAgent?.(ag)}
          onNewChat={(ag) => onNewChatWithAgent?.(ag)}
          onOpenRecentSession={(ag) => onOpenRecentSession?.(ag)}
          onMoveToSection={(ag, sId) => onMoveToSection?.(ag, sId)}
          onCreateSection={() => onCreateSectionModal?.()}
        />
      )}
    </aside>
  );
};
