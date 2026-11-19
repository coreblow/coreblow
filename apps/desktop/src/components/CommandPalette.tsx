import React, { useState, useEffect, useRef } from "react";

export interface CommandPaletteItem {
  id: string;
  title: string;
  subtitle?: string;
  shortcut?: string;
  category: "Actions" | "Sessions";
  action: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  threads: Array<{ id: string; title: string; updatedAt?: number }>;
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onNewChat: () => void;
  onToggleLayoutMode: () => void;
  layoutMode: "basic" | "pro";
  onToggleHud: () => void;
  onCaptureScreen: () => void;
  onRollback: () => void;
  onToggleEstop: () => void;
  estopPaused: boolean;
  onOpenSettings: (section?: any) => void;
  onSyncSessions: () => void;
  onRunSetupWizard: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  threads,
  activeThreadId,
  onSelectThread,
  onNewChat,
  onToggleLayoutMode,
  layoutMode,
  onToggleHud,
  onCaptureScreen,
  onRollback,
  onToggleEstop,
  estopPaused,
  onOpenSettings,
  onSyncSessions,
  onRunSetupWizard,
}) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  // Build items list
  const quickActions: CommandPaletteItem[] = [
    {
      id: "action-new-chat",
      title: "New Chat",
      subtitle: "Start a fresh sovereign reasoning thread",
      shortcut: "⌘N",
      category: "Actions",
      action: () => {
        onNewChat();
        onClose();
      },
    },
    {
      id: "action-toggle-layout",
      title: `Toggle Basic / Pro Mode (Current: ${layoutMode})`,
      subtitle: "Switch between distraction-free and multi-pane developer view",
      category: "Actions",
      action: () => {
        onToggleLayoutMode();
        onClose();
      },
    },
    {
      id: "action-toggle-hud",
      title: "Toggle Floating HUD",
      subtitle: "Compact always-on-top floating mode",
      shortcut: "⌘⇧H",
      category: "Actions",
      action: () => {
        onToggleHud();
        onClose();
      },
    },
    {
      id: "action-capture-screen",
      title: "Capture Screen & Attach",
      subtitle: "Instant desktop screenshot attached directly to chat",
      shortcut: "⌘⇧S",
      category: "Actions",
      action: () => {
        onCaptureScreen();
        onClose();
      },
    },
    {
      id: "action-rollback",
      title: "Undo Last Edit (/rollback)",
      subtitle: "Revert filesystem state to the last safe checkpoint",
      category: "Actions",
      action: () => {
        onRollback();
        onClose();
      },
    },
    {
      id: "action-toggle-estop",
      title: estopPaused ? "Resume Autonomous E-Stop" : "Emergency Stop (Pause)",
      subtitle: estopPaused ? "Resume queued agent operations" : "Halt all active multi-agent writes",
      category: "Actions",
      action: () => {
        onToggleEstop();
        onClose();
      },
    },
    {
      id: "action-open-settings",
      title: "Open Settings",
      subtitle: "API keys, models, MCP servers, and messaging channels",
      shortcut: "⌘,",
      category: "Actions",
      action: () => {
        onOpenSettings();
        onClose();
      },
    },
    {
      id: "action-sync-sessions",
      title: "Sync Remote Sessions",
      subtitle: "Synchronize unified session state across cluster nodes",
      category: "Actions",
      action: () => {
        onSyncSessions();
        onClose();
      },
    },
    {
      id: "action-setup-wizard",
      title: "Run Setup Wizard",
      subtitle: "Re-run the initial onboarding configuration flow",
      category: "Actions",
      action: () => {
        onRunSetupWizard();
        onClose();
      },
    },
  ];

  const sessionItems: CommandPaletteItem[] = threads.slice(0, 15).map((t) => ({
    id: `sess-${t.id}`,
    title: t.title || "Untitled Chat",
    subtitle: t.id === activeThreadId ? "Currently active" : `Session · ${t.id}`,
    category: "Sessions",
    action: () => {
      onSelectThread(t.id);
      onClose();
    },
  }));

  const allItems = [...quickActions, ...sessionItems];
  const q = query.trim().toLowerCase();
  const filtered = q
    ? allItems.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          (item.subtitle && item.subtitle.toLowerCase().includes(q)),
      )
    : allItems;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (filtered.length > 0 ? (prev + 1) % filtered.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filtered.length > 0 ? (prev - 1 + filtered.length) % filtered.length : 0,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "580px",
          maxWidth: "92vw",
          maxHeight: "70vh",
          backgroundColor: "var(--bg-card, #0B1916)",
          border: "1px solid var(--border-medium, #1B352E)",
          borderRadius: "var(--radius-md, 12px)",
          boxShadow: "0 20px 48px rgba(0, 0, 0, 0.7), 0 0 1px 1px rgba(45, 212, 191, 0.15)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header */}
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--border-subtle, #152A24)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <span style={{ color: "var(--accent-teal, #2DD4BF)", fontSize: "16px" }}>⌘K</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or jump to a session..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--ink-primary, #E2ECE9)",
              fontSize: "14px",
              fontFamily: "inherit",
            }}
          />
          <span
            style={{
              fontSize: "11px",
              padding: "2px 6px",
              borderRadius: "4px",
              background: "var(--bg-chip, #132722)",
              color: "var(--ink-muted, #5A776E)",
            }}
          >
            ESC to close
          </span>
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          style={{
            overflowY: "auto",
            padding: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          {filtered.length === 0 ? (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                color: "var(--ink-muted, #5A776E)",
                fontSize: "13px",
              }}
            >
              No matching commands or sessions found
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: isSelected
                      ? "var(--accent-teal-subtle, rgba(45, 212, 191, 0.12))"
                      : "transparent",
                    border: isSelected
                      ? "1px solid var(--accent-teal, #2DD4BF)"
                      : "1px solid transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    transition: "all 0.08s ease",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 500,
                        color: isSelected
                          ? "var(--accent-teal, #2DD4BF)"
                          : "var(--ink-primary, #E2ECE9)",
                      }}
                    >
                      {item.title}
                    </div>
                    {item.subtitle && (
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--ink-secondary, #819B93)",
                          marginTop: "2px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "var(--ink-muted, #5A776E)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: "var(--bg-chip, #132722)",
                      }}
                    >
                      {item.category}
                    </span>
                    {item.shortcut && (
                      <kbd
                        style={{
                          fontSize: "10px",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "var(--bg-chip, #132722)",
                          color: "var(--accent-teal, #2DD4BF)",
                          fontFamily: "var(--font-mono, monospace)",
                        }}
                      >
                        {item.shortcut}
                      </kbd>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
