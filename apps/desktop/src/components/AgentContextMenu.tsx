import React, { useEffect, useRef, useState } from "react";
import type { DesktopAgent, AgentSection } from "../types/gateway";
import {
  AgentsBrainIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  EditIcon,
  ExternalLinkIcon,
  EyeOffIcon,
  FolderIcon,
  PinIcon,
  PlusIcon,
  ScreenIcon,
  UsersIcon,
} from "./Icons";

export interface AgentContextMenuProps {
  agent: DesktopAgent;
  position: { x: number; y: number };
  sections: AgentSection[];
  onClose: () => void;
  onOpenChat: (agent: DesktopAgent) => void;
  onOpenChatInNewTab: (agent: DesktopAgent) => void;
  onOpenScreen: (agent: DesktopAgent) => void;
  onToggleAutoOpenScreen: (agent: DesktopAgent) => void;
  onTogglePin: (agent: DesktopAgent) => void;
  onToggleHide: (agent: DesktopAgent) => void;
  onEdit: (agent: DesktopAgent) => void;
  onManageGroups: (agent: DesktopAgent) => void;
  onDuplicate: (agent: DesktopAgent) => void;
  onNewChat: (agent: DesktopAgent) => void;
  onOpenRecentSession: (agent: DesktopAgent) => void;
  onMoveToSection: (agent: DesktopAgent, sectionId: string | null) => void;
  onCreateSection: () => void;
}

export const AgentContextMenu: React.FC<AgentContextMenuProps> = ({
  agent,
  position,
  sections,
  onClose,
  onOpenChat,
  onOpenChatInNewTab,
  onOpenScreen,
  onToggleAutoOpenScreen,
  onTogglePin,
  onToggleHide,
  onEdit,
  onManageGroups,
  onDuplicate,
  onNewChat,
  onOpenRecentSession,
  onMoveToSection,
  onCreateSection,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [sectionSubmenuOpen, setSectionSubmenuOpen] = useState(false);
  const [adjustedPos, setAdjustedPos] = useState({ top: position.y, left: position.x });

  // Clamp menu inside viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = position.x;
    let top = position.y;

    if (left + rect.width > vw - 12) {
      left = Math.max(12, vw - rect.width - 12);
    }
    if (top + rect.height > vh - 12) {
      top = Math.max(12, vh - rect.height - 12);
    }

    setAdjustedPos({ top, left });
  }, [position]);

  // Close on outside click or Escape
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const menuItemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 10px",
    borderRadius: "var(--radius-xs)",
    fontSize: "12px",
    color: "var(--ink-primary)",
    cursor: "pointer",
    userSelect: "none",
    transition: "background 0.1s ease",
    position: "relative",
  };

  const dividerStyle: React.CSSProperties = {
    height: "1px",
    background: "var(--border-subtle)",
    margin: "4px 0",
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: adjustedPos.top,
        left: adjustedPos.left,
        minWidth: "220px",
        background: "var(--bg-card)",
        border: "1px solid var(--border-medium)",
        borderRadius: "var(--radius-md)",
        padding: "5px",
        boxShadow: "var(--shadow-composer)",
        zIndex: 9999,
        fontFamily: "var(--font-ui)",
        backdropFilter: "blur(16px)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Group 1: Open & Live Screen */}
      <div
        style={menuItemStyle}
        onClick={() => {
          onOpenChat(agent);
          onClose();
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <AgentsBrainIcon size={13} color="var(--accent-teal)" />
          <span>Open agent chat</span>
        </div>
      </div>

      <div
        style={menuItemStyle}
        onClick={() => {
          onOpenChatInNewTab(agent);
          onClose();
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <ExternalLinkIcon size={13} color="var(--ink-secondary)" />
          <span>Open agent chat in new tab</span>
        </div>
      </div>

      <div
        style={menuItemStyle}
        onClick={() => {
          onOpenScreen(agent);
          onClose();
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <ScreenIcon size={13} color="var(--ink-secondary)" />
          <span>Open Screen</span>
        </div>
      </div>

      <div
        style={menuItemStyle}
        onClick={() => {
          onToggleAutoOpenScreen(agent);
          onClose();
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "13px", display: "grid", placeItems: "center" }}>
            {agent.autoOpenScreen ? <CheckIcon size={12} color="var(--accent-teal)" /> : null}
          </div>
          <span>Open Screen when the agent uses it</span>
        </div>
      </div>

      <div style={dividerStyle} />

      {/* Group 2: Visibility & Ordering */}
      <div
        style={menuItemStyle}
        onClick={() => {
          onTogglePin(agent);
          onClose();
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <PinIcon size={13} color={agent.pinned ? "var(--accent-teal)" : "var(--ink-secondary)"} />
          <span>{agent.pinned ? "Unpin" : "Pin to top"}</span>
        </div>
      </div>

      <div
        style={menuItemStyle}
        onClick={() => {
          onToggleHide(agent);
          onClose();
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <EyeOffIcon size={13} color="var(--ink-secondary)" />
          <span>{agent.hidden ? "Unhide" : "Hide"}</span>
        </div>
      </div>

      <div style={dividerStyle} />

      {/* Group 3: Configuration & Cloning */}
      <div
        style={menuItemStyle}
        onClick={() => {
          onEdit(agent);
          onClose();
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <EditIcon size={13} color="var(--ink-secondary)" />
          <span>Edit...</span>
        </div>
      </div>

      <div
        style={menuItemStyle}
        onClick={() => {
          onManageGroups(agent);
          onClose();
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <UsersIcon size={13} color="var(--ink-secondary)" />
          <span>Manage groups...</span>
        </div>
      </div>

      <div
        style={menuItemStyle}
        onClick={() => {
          onDuplicate(agent);
          onClose();
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <CopyIcon size={13} color="var(--ink-secondary)" />
          <span>Duplicate</span>
        </div>
      </div>

      <div style={dividerStyle} />

      {/* Group 4: Session Workflows */}
      <div
        style={menuItemStyle}
        onClick={() => {
          onNewChat(agent);
          onClose();
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <PlusIcon size={13} color="var(--ink-secondary)" />
          <span>New chat with this agent</span>
        </div>
      </div>

      <div
        style={menuItemStyle}
        onClick={() => {
          onOpenRecentSession(agent);
          onClose();
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <ClockIcon size={13} color="var(--ink-secondary)" />
          <span>Open recent session</span>
        </div>
      </div>

      <div style={dividerStyle} />

      {/* Group 5: Organization Submenu */}
      <div
        style={menuItemStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--bg-hover)";
          setSectionSubmenuOpen(true);
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FolderIcon size={13} color="var(--ink-secondary)" />
          <span>Move to section</span>
        </div>
        <span style={{ fontSize: "11px", color: "var(--ink-muted)" }}>▸</span>

        {/* Section Flyout Submenu */}
        {sectionSubmenuOpen && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "100%",
              marginLeft: "4px",
              minWidth: "180px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-medium)",
              borderRadius: "var(--radius-md)",
              padding: "4px",
              boxShadow: "var(--shadow-composer)",
              zIndex: 10000,
            }}
            onMouseEnter={() => setSectionSubmenuOpen(true)}
            onMouseLeave={() => setSectionSubmenuOpen(false)}
          >
            <div
              style={menuItemStyle}
              onClick={() => {
                onMoveToSection(agent, null);
                onClose();
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span>No section (Default)</span>
              {!agent.sectionId && <CheckIcon size={12} color="var(--accent-teal)" />}
            </div>

            {sections.map((sec) => (
              <div
                key={sec.id}
                style={menuItemStyle}
                onClick={() => {
                  onMoveToSection(agent, sec.id);
                  onClose();
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span>{sec.name}</span>
                {agent.sectionId === sec.id && <CheckIcon size={12} color="var(--accent-teal)" />}
              </div>
            ))}

            <div style={dividerStyle} />

            <div
              style={menuItemStyle}
              onClick={() => {
                onCreateSection();
                onClose();
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <PlusIcon size={11} color="var(--accent-teal)" />
                <span style={{ color: "var(--accent-teal)", fontWeight: 500 }}>New section...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
