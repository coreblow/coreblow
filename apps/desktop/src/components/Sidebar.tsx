import React, { useState } from "react";
import type { ChatThread } from "../types/gateway";
import {
  CoreBlowEmblem,
  FolderIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SidebarToggleIcon,
  SparklesIcon,
  TerminalIcon,
  TrashIcon,
  UsersIcon,
} from "./Icons";

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
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSegment, setActiveSegment] = useState<"sessions" | "squad">("sessions");
  const isMac = window.coreblowDesktop?.platform === "darwin";

  const filteredThreads = threads.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const pinnedThreads = filteredThreads.filter((t) => t.pinned);
  const recentThreads = filteredThreads.filter((t) => !t.pinned);

  const handleSquadClick = () => {
    setActiveSegment("squad");
    onOpenTab?.("warroom");
  };

  const handleSessionsClick = () => {
    setActiveSegment("sessions");
  };

  if (collapsed) {
    return (
      <aside
        style={{
          width: "var(--sidebar-collapsed)",
          height: "100%",
          background: "var(--bg-sidebar)",
          borderRight: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: isMac ? "48px 0 16px" : "12px 0 16px",
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
          onClick={handleSquadClick}
          title="War Room Squad"
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
          <UsersIcon size={18} />
        </button>

        <button
          type="button"
          onClick={() => onOpenTab?.("corehub")}
          title="Capabilities (Skills & Marketplace)"
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
          <SparklesIcon size={18} />
        </button>

        <button
          type="button"
          onClick={() => onOpenTab?.("memory")}
          title="Cory Memory Wiki"
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
          <FolderIcon size={18} />
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
        width: "var(--sidebar-default)",
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
      {/* Top window clearance & branding */}
      <div
        data-window-drag
        style={{
          height: "48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: isMac ? "0 4px 0 72px" : "0 4px 0 12px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <CoreBlowEmblem size={18} color="var(--accent-teal)" />
          <span style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.04em", color: "var(--ink-primary)" }}>
            COREBLOW
          </span>
          <span
            style={{
              fontSize: "10px",
              padding: "1px 5px",
              borderRadius: "var(--radius-xs)",
              background: "var(--accent-teal-subtle)",
              color: "var(--accent-teal)",
              fontWeight: 600,
            }}
          >
            v2.0
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

      {/* Top Segmented Switcher: SESSIONS | SQUAD */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "4px",
          background: "var(--bg-chip)",
          padding: "3px",
          borderRadius: "8px",
          margin: "4px 0 8px",
        }}
      >
        <button
          type="button"
          onClick={handleSessionsClick}
          style={{
            background: activeSegment === "sessions" ? "var(--bg-card)" : "transparent",
            color: activeSegment === "sessions" ? "var(--accent-teal)" : "var(--ink-muted)",
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
          onClick={handleSquadClick}
          style={{
            background: activeSegment === "squad" ? "var(--bg-card)" : "transparent",
            color: activeSegment === "squad" ? "var(--accent-teal)" : "var(--ink-muted)",
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
          SQUAD
        </button>
      </div>

      {/* New Chat Button */}
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
            background: "var(--accent-teal-subtle)",
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

      {/* Quick Navigation Links: macOS-native borderless vertical list */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          marginBottom: "10px",
        }}
      >
        {[
          {
            label: "Capabilities",
            icon: <SparklesIcon size={14} color="var(--accent-teal)" />,
            onClick: () => onOpenTab?.("corehub"),
            title: "Skills & Storefront Marketplace",
          },
          {
            label: "Memory",
            icon: <FolderIcon size={14} color="var(--accent-teal)" />,
            onClick: () => onOpenTab?.("memory"),
            title: "Cory Memory Wiki",
          },
          {
            label: "Scheduled jobs",
            icon: <TerminalIcon size={14} color="var(--accent-teal)" />,
            onClick: () => onOpenSettings("automations"),
            title: "Scheduled Automations & Background Tasks",
          },
          {
            label: "Remote Nodes",
            icon: <span style={{ fontSize: "13px", lineHeight: 1 }}>🌐</span>,
            onClick: () => onOpenSettings("remotes"),
            title: "24/7 Always-On Remote Nodes",
          },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            title={item.title}
            style={{
              height: "30px",
              padding: "0 10px",
              borderRadius: "6px",
              background: "transparent",
              border: "none",
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
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Search Filter */}
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

      {/* Threads List (PINNED + SESSIONS) */}
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
          <>
            {/* Pinned section */}
            {pinnedThreads.length > 0 && (
              <div style={{ marginBottom: "8px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 8px",
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    color: "var(--ink-muted)",
                  }}
                >
                  <PinIcon size={10} color="var(--accent-teal)" />
                  <span>PINNED</span>
                  <span style={{ opacity: 0.6 }}>({pinnedThreads.length})</span>
                </div>
                {pinnedThreads.map((thread) => {
                  const isActive = thread.id === activeThreadId;
                  return (
                    <div
                      key={thread.id}
                      onClick={() => onSelectThread(thread.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 10px",
                        borderRadius: "var(--radius-sm)",
                        background: isActive ? "var(--bg-chip)" : "transparent",
                        border: isActive ? "1px solid var(--border-medium)" : "1px solid transparent",
                        color: isActive ? "var(--ink-primary)" : "var(--ink-secondary)",
                        cursor: "pointer",
                        fontSize: "12px",
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

                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTogglePinThread?.(thread.id);
                          }}
                          title="Unpin conversation"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--accent-teal)",
                            cursor: "pointer",
                            padding: "2px",
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          <PinIcon size={11} color="var(--accent-teal)" />
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
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          <TrashIcon size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Recent Sessions header if pinned items exist */}
            {pinnedThreads.length > 0 && recentThreads.length > 0 && (
              <div
                style={{
                  padding: "4px 8px",
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: "var(--ink-muted)",
                }}
              >
                SESSIONS
              </div>
            )}

            {/* Recent Sessions list */}
            {recentThreads.map((thread) => {
              const isActive = thread.id === activeThreadId;
              return (
                <div
                  key={thread.id}
                  onClick={() => onSelectThread(thread.id)}
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
                      fontWeight: isActive ? 500 : 400,
                    }}
                  >
                    {thread.title}
                  </span>

                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePinThread?.(thread.id);
                      }}
                      title="Pin conversation"
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
                      <PinIcon size={11} />
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
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <TrashIcon size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Bottom Profile / Settings Trigger */}
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
    </aside>
  );
};
