import React, { useState, useEffect, useRef } from "react";
import { gatewayClient } from "../../services/gateway-client";
import type {
  AgentScreenFrame,
  WarRoomMember,
  WarRoomRole,
  WarRoomState,
} from "../../types/gateway";
import {
  SendIcon,
  ShieldIcon,
  SparklesIcon,
  TerminalIcon,
  RefreshIcon,
  CheckIcon,
  CloseIcon,
} from "../Icons";

export const WarRoomTab: React.FC = () => {
  const [roomState, setRoomState] = useState<WarRoomState | null>(null);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [screenFrames, setScreenFrames] = useState<AgentScreenFrame[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const screenScrollRef = useRef<HTMLDivElement>(null);

  const fetchState = async () => {
    try {
      const state = await gatewayClient.getWarRoomState("coreblow-squad");
      if (state) {
        setRoomState(state);
        if (state.screenFeed && state.screenFeed.length > 0) {
          setScreenFrames(state.screenFeed);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = gatewayClient.subscribeWarRoomScreen("coreblow-squad", (frame) => {
      if (!isPausedRef.current) {
        setScreenFrames((prev) => [...prev.slice(-150), frame]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [roomState?.messages]);

  useEffect(() => {
    if (screenScrollRef.current && !isPaused) {
      screenScrollRef.current.scrollTop = screenScrollRef.current.scrollHeight;
    }
  }, [screenFrames, isPaused]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    setInputText("");
    try {
      const result = await gatewayClient.postWarRoomMessage("coreblow-squad", text);
      if (result?.room) {
        setRoomState(result.room);
      } else {
        await fetchState();
      }
    } finally {
      setSending(false);
    }
  };

  const handleResolveApproval = async (approvalId: string, decision: "approved" | "denied") => {
    await gatewayClient.resolveWarRoomApproval("coreblow-squad", approvalId, decision);
    await fetchState();
  };

  const addMention = (tag: string) => {
    setInputText((prev) => (prev ? `${prev.trim()} ${tag} ` : `${tag} `));
  };

  const getMemberStatusBadge = (member: WarRoomMember) => {
    switch (member.liveState) {
      case "thinking":
        return { label: "Thinking", color: "var(--accent-teal)", bg: "rgba(45, 212, 191, 0.15)" };
      case "executing_tool":
        return { label: "Executing", color: "var(--accent-cyan, #38bdf8)", bg: "rgba(56, 189, 248, 0.15)" };
      case "awaiting_approval":
        return { label: "Approval", color: "var(--state-warning, #f59e0b)", bg: "rgba(245, 158, 11, 0.15)" };
      case "completed":
        return { label: "Done", color: "var(--state-success, #10b981)", bg: "rgba(16, 185, 129, 0.15)" };
      case "idle":
      default:
        return { label: "Idle", color: "var(--ink-muted)", bg: "var(--bg-chip)" };
    }
  };

  const getFrameColor = (kind: AgentScreenFrame["kind"]) => {
    switch (kind) {
      case "tool_start":
      case "tool_done":
        return "var(--accent-teal)";
      case "tool_output":
        return "var(--ink-secondary)";
      case "thinking":
        return "#38bdf8";
      case "approval":
        return "#f59e0b";
      case "kanban_move":
        return "#a855f7";
      case "chat_message":
      default:
        return "var(--ink-primary)";
    }
  };

  const filteredFrames = screenFrames.filter((f) => {
    if (roleFilter === "all") return true;
    return f.role === roleFilter || f.agentId.includes(roleFilter);
  });

  const kanbanCounts = {
    backlog: roomState?.kanbanBoard?.filter((c) => c.column === "backlog").length ?? 0,
    in_progress: roomState?.kanbanBoard?.filter((c) => c.column === "in_progress").length ?? 0,
    review: roomState?.kanbanBoard?.filter((c) => c.column === "review").length ?? 0,
    done: roomState?.kanbanBoard?.filter((c) => c.column === "done").length ?? 0,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* ── PANEL 1: SQUAD ROSTER, KANBAN COUNTS & APPROVALS ── */}
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-md)",
          padding: "12px",
          border: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--ink-muted)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Squad Roster &amp; Board
          </div>
          <button
            type="button"
            onClick={fetchState}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--ink-muted)",
              cursor: "pointer",
              padding: "2px",
            }}
            title="Refresh Squad State"
          >
            <RefreshIcon size={12} />
          </button>
        </div>

        {/* Specialists Roster Grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {(roomState?.members ?? [
            { agentId: "agent-lead", name: "Lead Orchestrator", role: "lead", routeTier: "decision", liveState: "idle" },
            { agentId: "agent-coder", name: "Code Specialist", role: "coder", routeTier: "coding", liveState: "idle" },
            { agentId: "agent-researcher", name: "Research Specialist", role: "researcher", routeTier: "deep", liveState: "idle" },
            { agentId: "agent-auditor", name: "Security Auditor", role: "auditor", routeTier: "deep", liveState: "idle" },
            { agentId: "agent-verifier", name: "Verification Specialist", role: "verifier", routeTier: "fast", liveState: "idle" },
          ]).map((member) => {
            const badge = getMemberStatusBadge(member);
            return (
              <div
                key={member.agentId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 8px",
                  background: "var(--bg-chip)",
                  borderRadius: "var(--radius-xs)",
                  fontSize: "11px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {member.role === "auditor" ? (
                    <ShieldIcon size={12} color="var(--accent-teal)" />
                  ) : member.role === "coder" || member.role === "verifier" ? (
                    <TerminalIcon size={12} color="var(--accent-teal)" />
                  ) : (
                    <SparklesIcon size={12} color="var(--accent-teal)" />
                  )}
                  <span style={{ fontWeight: 600, color: "var(--ink-primary)" }}>{member.name}</span>
                  <span style={{ color: "var(--ink-muted)", fontSize: "10px" }}>@{member.role}</span>
                </div>
                <span
                  style={{
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: badge.bg,
                    color: badge.color,
                    fontSize: "10px",
                    fontWeight: 600,
                  }}
                >
                  {badge.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Kanban Board Counts Summary */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "4px",
            background: "var(--bg-code)",
            padding: "6px",
            borderRadius: "var(--radius-xs)",
            textAlign: "center",
            fontSize: "10px",
          }}
        >
          <div>
            <div style={{ color: "var(--ink-muted)" }}>Backlog</div>
            <div style={{ fontWeight: 700, color: "var(--ink-primary)" }}>{kanbanCounts.backlog}</div>
          </div>
          <div>
            <div style={{ color: "var(--accent-teal)" }}>Running</div>
            <div style={{ fontWeight: 700, color: "var(--accent-teal)" }}>{kanbanCounts.in_progress}</div>
          </div>
          <div>
            <div style={{ color: "#f59e0b" }}>Review</div>
            <div style={{ fontWeight: 700, color: "#f59e0b" }}>{kanbanCounts.review}</div>
          </div>
          <div>
            <div style={{ color: "#10b981" }}>Done</div>
            <div style={{ fontWeight: 700, color: "#10b981" }}>{kanbanCounts.done}</div>
          </div>
        </div>

        {/* Pending Approvals Section */}
        {roomState?.pendingApprovals && roomState.pendingApprovals.length > 0 && (
          <div
            style={{
              padding: "8px",
              background: "rgba(245, 158, 11, 0.08)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: "var(--radius-xs)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#f59e0b" }}>
              Pending Tool Execution Approval:
            </div>
            {roomState.pendingApprovals.map((appr) => (
              <div
                key={appr.approvalId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "11px",
                  color: "var(--ink-primary)",
                }}
              >
                <span>
                  <strong>{appr.agentId}</strong>: <code>{appr.toolName}</code>
                </span>
                <div style={{ display: "flex", gap: "4px" }}>
                  <button
                    type="button"
                    onClick={() => handleResolveApproval(appr.approvalId, "approved")}
                    style={{
                      background: "var(--accent-teal)",
                      color: "#000",
                      border: "none",
                      padding: "2px 6px",
                      borderRadius: "3px",
                      fontSize: "10px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "2px",
                    }}
                  >
                    <CheckIcon size={10} color="#000" /> Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResolveApproval(appr.approvalId, "denied")}
                    style={{
                      background: "rgba(239, 68, 68, 0.2)",
                      color: "#ef4444",
                      border: "1px solid rgba(239, 68, 68, 0.4)",
                      padding: "2px 6px",
                      borderRadius: "3px",
                      fontSize: "10px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "2px",
                    }}
                  >
                    <CloseIcon size={10} /> Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── PANEL 2: SQUAD GROUP CHAT WITH @MENTION ROUTING ── */}
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-md)",
          padding: "12px",
          border: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--ink-muted)",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          Squad Group Chat (@mention)
        </div>

        {/* Message History Timeline */}
        <div
          ref={chatScrollRef}
          style={{
            maxHeight: "180px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            paddingRight: "4px",
          }}
        >
          {(!roomState?.messages || roomState.messages.length === 0) ? (
            <div style={{ fontSize: "11px", color: "var(--ink-muted)", fontStyle: "italic", textAlign: "center", padding: "16px 0" }}>
              No messages yet. Use @coder, @auditor, @researcher, @verifier or @all to dispatch specialists.
            </div>
          ) : (
            roomState.messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  background: msg.senderRole === "user" ? "var(--bg-chip)" : "var(--bg-code)",
                  padding: "8px 10px",
                  borderRadius: "var(--radius-xs)",
                  fontSize: "11px",
                  borderLeft: `3px solid ${
                    msg.senderRole === "user"
                      ? "var(--ink-muted)"
                      : msg.senderRole === "auditor"
                      ? "#38bdf8"
                      : msg.senderRole === "coder"
                      ? "var(--accent-teal)"
                      : msg.senderRole === "verifier"
                      ? "#10b981"
                      : "#a855f7"
                  }`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "10px" }}>
                  <span style={{ fontWeight: 700, color: "var(--ink-primary)" }}>{msg.senderName}</span>
                  <span style={{ color: "var(--ink-muted)" }}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div style={{ color: "var(--ink-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
                  {msg.content}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Quick Mention Chips */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap", paddingTop: "4px" }}>
          <span style={{ fontSize: "10px", color: "var(--ink-muted)" }}>Dispatch:</span>
          {["@all", "@coder", "@researcher", "@auditor", "@verifier"].map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => addMention(tag)}
              style={{
                background: "var(--bg-chip)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "3px",
                padding: "2px 5px",
                fontSize: "10px",
                fontWeight: 600,
                color: tag === "@all" ? "var(--accent-teal)" : "var(--ink-secondary)",
                cursor: "pointer",
              }}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Composer Form */}
        <form onSubmit={handleSend} style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Instruct squad (@coder, @all)..."
            disabled={sending}
            style={{
              flex: 1,
              background: "var(--bg-code)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-xs)",
              padding: "6px 10px",
              fontSize: "11px",
              color: "var(--ink-primary)",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={sending || !inputText.trim()}
            style={{
              background: "var(--accent-teal)",
              color: "#000",
              border: "none",
              borderRadius: "var(--radius-xs)",
              padding: "0 10px",
              cursor: sending ? "not-allowed" : "pointer",
              opacity: sending || !inputText.trim() ? 0.5 : 1,
              display: "grid",
              placeItems: "center",
            }}
          >
            <SendIcon size={12} color="#000" />
          </button>
        </form>
      </div>

      {/* ── PANEL 3: LIVE AGENT SCREEN (REAL-TIME SSE FEED) ── */}
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-md)",
          padding: "12px",
          border: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--ink-muted)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: isPaused ? "#f59e0b" : "var(--accent-teal)",
                display: "inline-block",
              }}
            />
            Live Agent Screen
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {/* Filter Dropdown */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{
                background: "var(--bg-code)",
                color: "var(--ink-secondary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-xs)",
                fontSize: "10px",
                padding: "2px 4px",
              }}
            >
              <option value="all">All Specialists</option>
              <option value="coder">coder</option>
              <option value="researcher">researcher</option>
              <option value="auditor">auditor</option>
              <option value="verifier">verifier</option>
              <option value="lead">lead</option>
            </select>

            <button
              type="button"
              onClick={() => setIsPaused((p) => !p)}
              style={{
                background: "var(--bg-chip)",
                border: "none",
                borderRadius: "var(--radius-xs)",
                padding: "2px 6px",
                fontSize: "10px",
                fontWeight: 600,
                color: isPaused ? "#f59e0b" : "var(--ink-secondary)",
                cursor: "pointer",
              }}
            >
              {isPaused ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              onClick={() => setScreenFrames([])}
              style={{
                background: "var(--bg-chip)",
                border: "none",
                borderRadius: "var(--radius-xs)",
                padding: "2px 6px",
                fontSize: "10px",
                color: "var(--ink-muted)",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Real-time Activity Stream Window */}
        <div
          ref={screenScrollRef}
          style={{
            height: "170px",
            overflowY: "auto",
            background: "var(--bg-code)",
            borderRadius: "var(--radius-xs)",
            padding: "8px",
            fontFamily: "var(--font-mono)",
            fontSize: "10.5px",
            lineHeight: 1.5,
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {filteredFrames.length === 0 ? (
            <div style={{ color: "var(--ink-muted)", fontStyle: "italic", textAlign: "center", paddingTop: "20px" }}>
              Waiting for agent activity or tool executions...
            </div>
          ) : (
            filteredFrames.map((frame) => {
              const frameColor = getFrameColor(frame.kind);
              return (
                <div key={frame.id} style={{ display: "flex", gap: "6px" }}>
                  <span style={{ color: "var(--ink-muted)", flexShrink: 0 }}>
                    {new Date(frame.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                  <span style={{ color: frameColor, fontWeight: 700, flexShrink: 0 }}>
                    [{frame.role}]
                  </span>
                  <span style={{ color: "var(--ink-secondary)", wordBreak: "break-word" }}>
                    <strong style={{ color: frameColor }}>{frame.kind}:</strong> {frame.summary}
                    {frame.detail && (
                      <span style={{ color: "var(--ink-muted)", display: "block", fontSize: "10px" }}>
                        ↳ {frame.detail.slice(0, 160)}
                      </span>
                    )}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
