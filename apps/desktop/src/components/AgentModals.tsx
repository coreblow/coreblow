import React, { useState, useEffect } from "react";
import type { DesktopAgent, AgentSection, AgentGroup } from "../types/gateway";
import { CheckIcon, CloseIcon, PlusIcon, UsersIcon } from "./Icons";

const ACCENT_SWATCHES = [
  "#2DD4BF", // Sovereign Teal
  "#10B981", // Emerald
  "#38BDF8", // Sky
  "#8B5CF6", // Purple
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#6366F1", // Indigo
  "#14B8A6", // Teal
];

const MODEL_OPTIONS = [
  { id: "coreblow/balanced", label: "CoreBlow Balanced (Default)" },
  { id: "coreblow/coder", label: "CoreBlow Coder" },
  { id: "coreblow/deepthink", label: "CoreBlow DeepThink" },
  { id: "coreblow/fast", label: "CoreBlow Fast" },
];

// ─── 1. Agent Editor Modal ──────────────────────────────────────────────────

export interface AgentEditorModalProps {
  open: boolean;
  agent?: DesktopAgent | null;
  sections: AgentSection[];
  onClose: () => void;
  onSave: (data: {
    name: string;
    tagline: string;
    systemPrompt: string;
    defaultModel: string;
    accentColor: string;
    sectionId: string | null;
  }) => void;
}

export const AgentEditorModal: React.FC<AgentEditorModalProps> = ({
  open,
  agent,
  sections,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [defaultModel, setDefaultModel] = useState("coreblow/balanced");
  const [accentColor, setAccentColor] = useState(ACCENT_SWATCHES[0]);
  const [sectionId, setSectionId] = useState<string | null>(null);

  useEffect(() => {
    if (agent) {
      setName(agent.name);
      setTagline(agent.tagline || "");
      setSystemPrompt(agent.systemPrompt || "");
      setDefaultModel(agent.defaultModel || "coreblow/balanced");
      setAccentColor(agent.accentColor || ACCENT_SWATCHES[0]);
      setSectionId(agent.sectionId || null);
    } else {
      setName("");
      setTagline("Say something to get started.");
      setSystemPrompt("");
      setDefaultModel("coreblow/balanced");
      setAccentColor(ACCENT_SWATCHES[0]);
      setSectionId(null);
    }
  }, [agent, open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      tagline: tagline.trim() || "Say something to get started.",
      systemPrompt: systemPrompt.trim(),
      defaultModel,
      accentColor,
      sectionId,
    });
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(12px)",
        display: "grid",
        placeItems: "center",
        zIndex: 10000,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(520px, 94vw)",
          background: "var(--bg-card)",
          border: "1px solid var(--border-medium)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-composer)",
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--ink-primary)" }}>
            {agent ? `Edit Agent: ${agent.name}` : "Create New Agent"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--ink-muted)",
              cursor: "pointer",
              padding: "4px",
              display: "grid",
              placeItems: "center",
            }}
          >
            <CloseIcon size={14} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--ink-secondary)", marginBottom: "4px" }}>
              Agent Name
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Coder, Architect, Researcher"
              style={{
                width: "100%",
                height: "32px",
                background: "var(--bg-input)",
                border: "1px solid var(--border-medium)",
                borderRadius: "var(--radius-xs)",
                padding: "0 10px",
                color: "var(--ink-primary)",
                fontSize: "12.5px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--ink-secondary)", marginBottom: "4px" }}>
              Tagline / Greeting
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g. Specialist in autonomous reasoning and tool use"
              style={{
                width: "100%",
                height: "32px",
                background: "var(--bg-input)",
                border: "1px solid var(--border-medium)",
                borderRadius: "var(--radius-xs)",
                padding: "0 10px",
                color: "var(--ink-primary)",
                fontSize: "12.5px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--ink-secondary)", marginBottom: "4px" }}>
              System Prompt (Governs Agent Behavior)
            </label>
            <textarea
              rows={4}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are CoreBlow Coder, an elite engineering agent with deep expertise..."
              style={{
                width: "100%",
                background: "var(--bg-input)",
                border: "1px solid var(--border-medium)",
                borderRadius: "var(--radius-xs)",
                padding: "8px 10px",
                color: "var(--ink-primary)",
                fontSize: "12px",
                fontFamily: "var(--font-mono)",
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
                lineHeight: 1.5,
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--ink-secondary)", marginBottom: "4px" }}>
                Default Model
              </label>
              <select
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                style={{
                  width: "100%",
                  height: "32px",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-medium)",
                  borderRadius: "var(--radius-xs)",
                  padding: "0 8px",
                  color: "var(--ink-primary)",
                  fontSize: "12px",
                  outline: "none",
                }}
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--ink-secondary)", marginBottom: "4px" }}>
                Section
              </label>
              <select
                value={sectionId || ""}
                onChange={(e) => setSectionId(e.target.value || null)}
                style={{
                  width: "100%",
                  height: "32px",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-medium)",
                  borderRadius: "var(--radius-xs)",
                  padding: "0 8px",
                  color: "var(--ink-primary)",
                  fontSize: "12px",
                  outline: "none",
                }}
              >
                <option value="">No section (Default)</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--ink-secondary)", marginBottom: "6px" }}>
              Accent Swatch
            </label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {ACCENT_SWATCHES.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAccentColor(color)}
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: color,
                    border: accentColor === color ? "2px solid #FFFFFF" : "1px solid var(--border-medium)",
                    boxShadow: accentColor === color ? `0 0 8px ${color}` : "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: "30px",
                padding: "0 12px",
                borderRadius: "var(--radius-xs)",
                background: "transparent",
                border: "1px solid var(--border-subtle)",
                color: "var(--ink-secondary)",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              style={{
                height: "30px",
                padding: "0 16px",
                borderRadius: "var(--radius-xs)",
                background: "var(--accent-teal)",
                border: "none",
                color: "#08110F",
                fontSize: "12px",
                fontWeight: 600,
                cursor: name.trim() ? "pointer" : "default",
                opacity: name.trim() ? 1 : 0.6,
              }}
            >
              {agent ? "Save Changes" : "Create Agent"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── 2. New Section Modal ───────────────────────────────────────────────────

export interface NewSectionModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

export const NewSectionModal: React.FC<NewSectionModalProps> = ({ open, onClose, onCreate }) => {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim());
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(12px)",
        display: "grid",
        placeItems: "center",
        zIndex: 10000,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(380px, 94vw)",
          background: "var(--bg-card)",
          border: "1px solid var(--border-medium)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-composer)",
          padding: "18px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--ink-primary)" }}>
            New Section
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--ink-muted)",
              cursor: "pointer",
              padding: "4px",
              display: "grid",
              placeItems: "center",
            }}
          >
            <CloseIcon size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--ink-secondary)", marginBottom: "4px" }}>
              Section Name
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Engineering, Research, QA"
              style={{
                width: "100%",
                height: "32px",
                background: "var(--bg-input)",
                border: "1px solid var(--border-medium)",
                borderRadius: "var(--radius-xs)",
                padding: "0 10px",
                color: "var(--ink-primary)",
                fontSize: "12.5px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "6px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: "28px",
                padding: "0 10px",
                borderRadius: "var(--radius-xs)",
                background: "transparent",
                border: "1px solid var(--border-subtle)",
                color: "var(--ink-secondary)",
                fontSize: "11.5px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              style={{
                height: "28px",
                padding: "0 14px",
                borderRadius: "var(--radius-xs)",
                background: "var(--accent-teal)",
                border: "none",
                color: "#08110F",
                fontSize: "11.5px",
                fontWeight: 600,
                cursor: name.trim() ? "pointer" : "default",
                opacity: name.trim() ? 1 : 0.6,
              }}
            >
              Create Section
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── 3. New Group Chat Modal ────────────────────────────────────────────────

export interface NewGroupChatModalProps {
  open: boolean;
  agents: DesktopAgent[];
  onClose: () => void;
  onCreate: (name: string, selectedAgentIds: string[]) => void;
}

export const NewGroupChatModal: React.FC<NewGroupChatModalProps> = ({
  open,
  agents,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setName("Squad Group Chat");
      setSelectedIds(agents.slice(0, 3).map((a) => a.id));
    }
  }, [open, agents]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const toggleAgent = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || selectedIds.length < 2) return;
    onCreate(name.trim(), selectedIds);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(12px)",
        display: "grid",
        placeItems: "center",
        zIndex: 10000,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(440px, 94vw)",
          background: "var(--bg-card)",
          border: "1px solid var(--border-medium)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-composer)",
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <UsersIcon size={16} color="var(--accent-teal)" />
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--ink-primary)" }}>
              New Group Chat
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--ink-muted)",
              cursor: "pointer",
              padding: "4px",
              display: "grid",
              placeItems: "center",
            }}
          >
            <CloseIcon size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--ink-secondary)", marginBottom: "4px" }}>
              Group Name
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Architecture Squad"
              style={{
                width: "100%",
                height: "32px",
                background: "var(--bg-input)",
                border: "1px solid var(--border-medium)",
                borderRadius: "var(--radius-xs)",
                padding: "0 10px",
                color: "var(--ink-primary)",
                fontSize: "12.5px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--ink-secondary)", marginBottom: "6px" }}>
              Select Participating Agents (Choose 2+)
            </label>
            <div
              style={{
                maxHeight: "180px",
                overflowY: "auto",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                padding: "6px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                background: "var(--bg-input)",
              }}
            >
              {agents.map((ag) => {
                const isSelected = selectedIds.includes(ag.id);
                return (
                  <div
                    key={ag.id}
                    onClick={() => toggleAgent(ag.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 8px",
                      borderRadius: "var(--radius-xs)",
                      background: isSelected ? "var(--bg-chip)" : "transparent",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: ag.accentColor || "var(--accent-teal)",
                        }}
                      />
                      <span style={{ color: "var(--ink-primary)", fontWeight: isSelected ? 600 : 400 }}>
                        {ag.name}
                      </span>
                    </div>
                    {isSelected && <CheckIcon size={12} color="var(--accent-teal)" />}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: "30px",
                padding: "0 12px",
                borderRadius: "var(--radius-xs)",
                background: "transparent",
                border: "1px solid var(--border-subtle)",
                color: "var(--ink-secondary)",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || selectedIds.length < 2}
              style={{
                height: "30px",
                padding: "0 16px",
                borderRadius: "var(--radius-xs)",
                background: "var(--accent-teal)",
                border: "none",
                color: "#08110F",
                fontSize: "12px",
                fontWeight: 600,
                cursor: name.trim() && selectedIds.length >= 2 ? "pointer" : "default",
                opacity: name.trim() && selectedIds.length >= 2 ? 1 : 0.6,
              }}
            >
              Start Group Chat
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── 4. Manage Groups Modal ─────────────────────────────────────────────────

export interface ManageGroupsModalProps {
  open: boolean;
  agent: DesktopAgent;
  groups: AgentGroup[];
  onClose: () => void;
  onToggleAgentGroup: (groupId: string, agentId: string) => void;
  onCreateGroup: (name: string, agentId: string) => void;
}

export const ManageGroupsModal: React.FC<ManageGroupsModalProps> = ({
  open,
  agent,
  groups,
  onClose,
  onToggleAgentGroup,
  onCreateGroup,
}) => {
  const [newGroupName, setNewGroupName] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    onCreateGroup(newGroupName.trim(), agent.id);
    setNewGroupName("");
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(12px)",
        display: "grid",
        placeItems: "center",
        zIndex: 10000,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(420px, 94vw)",
          background: "var(--bg-card)",
          border: "1px solid var(--border-medium)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-composer)",
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--ink-primary)" }}>
              Manage Groups
            </h2>
            <span style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
              Assign {agent.name} to agent groups
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--ink-muted)",
              cursor: "pointer",
              padding: "4px",
              display: "grid",
              placeItems: "center",
            }}
          >
            <CloseIcon size={14} />
          </button>
        </div>

        {/* Existing Groups List */}
        <div
          style={{
            maxHeight: "180px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          {groups.length === 0 ? (
            <div style={{ padding: "16px", textAlign: "center", fontSize: "11.5px", color: "var(--ink-muted)" }}>
              No groups created yet. Create one below!
            </div>
          ) : (
            groups.map((grp) => {
              const isInGroup = grp.agentIds.includes(agent.id);
              return (
                <div
                  key={grp.id}
                  onClick={() => onToggleAgentGroup(grp.id, agent.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    borderRadius: "var(--radius-sm)",
                    background: isInGroup ? "var(--bg-chip)" : "var(--bg-input)",
                    border: "1px solid var(--border-subtle)",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <UsersIcon size={13} color="var(--accent-teal)" />
                    <span style={{ color: "var(--ink-primary)", fontWeight: isInGroup ? 600 : 400 }}>
                      {grp.name}
                    </span>
                    <span style={{ fontSize: "10.5px", color: "var(--ink-muted)" }}>
                      ({grp.agentIds.length} agents)
                    </span>
                  </div>
                  {isInGroup && <CheckIcon size={12} color="var(--accent-teal)" />}
                </div>
              );
            })
          )}
        </div>

        {/* Create Group Inline */}
        <form onSubmit={handleCreate} style={{ display: "flex", gap: "6px" }}>
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="New group name..."
            style={{
              flex: 1,
              height: "30px",
              background: "var(--bg-input)",
              border: "1px solid var(--border-medium)",
              borderRadius: "var(--radius-xs)",
              padding: "0 8px",
              color: "var(--ink-primary)",
              fontSize: "12px",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={!newGroupName.trim()}
            style={{
              height: "30px",
              padding: "0 10px",
              borderRadius: "var(--radius-xs)",
              background: "var(--accent-teal-subtle)",
              border: "1px solid var(--accent-teal)",
              color: "var(--accent-teal)",
              fontSize: "11px",
              fontWeight: 600,
              cursor: newGroupName.trim() ? "pointer" : "default",
            }}
          >
            <PlusIcon size={11} /> Add
          </button>
        </form>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: "28px",
              padding: "0 14px",
              borderRadius: "var(--radius-xs)",
              background: "var(--bg-chip)",
              border: "1px solid var(--border-subtle)",
              color: "var(--ink-primary)",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
