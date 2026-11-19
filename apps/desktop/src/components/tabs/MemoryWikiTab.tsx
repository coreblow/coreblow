import React, { useState, useEffect } from "react";
import { gatewayClient } from "../../services/gateway-client";
import type {
  CoryMemoryItem,
  CoryProfilePayload,
  MemoryProposal,
} from "../../types/gateway";
import {
  CheckIcon,
  CloseIcon,
  CopyIcon,
  RefreshIcon,
  SearchIcon,
  ShieldIcon,
  SparklesIcon,
} from "../Icons";

export const MemoryWikiTab: React.FC = () => {
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [profileData, setProfileData] = useState<CoryProfilePayload | null>(null);
  const [loading, setLoading] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CoryMemoryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Inline add input states
  const [newAboutMe, setNewAboutMe] = useState("");
  const [newProjectNote, setNewProjectNote] = useState("");
  const [newAlwaysFollow, setNewAlwaysFollow] = useState("");

  // Wiki compile state
  const [compiling, setCompiling] = useState(false);
  const [wikiResult, setWikiResult] = useState<{ path: string; markdown: string } | null>(null);
  const [copiedWiki, setCopiedWiki] = useState(false);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await gatewayClient.getCoryProfile();
      if (data) {
        setProfileData(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const hits = await gatewayClient.searchMemory(q);
      setSearchResults(hits);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddItem = async (layer: "identity" | "durable" | "constraint", content: string) => {
    const text = content.trim();
    if (!text) return;
    const ok = await gatewayClient.rememberMemory(text, layer);
    if (ok) {
      if (layer === "identity") setNewAboutMe("");
      if (layer === "durable") setNewProjectNote("");
      if (layer === "constraint") setNewAlwaysFollow("");
      await fetchProfile();
    }
  };

  const handleDeleteItem = async (id: string) => {
    const ok = await gatewayClient.forgetMemory(id);
    if (ok) {
      await fetchProfile();
      setSearchResults((prev) => prev.filter((i) => i.id !== id));
    }
  };

  const handleResolveProposal = async (id: string, decision: "approve" | "dismiss") => {
    const ok = await gatewayClient.resolveMemoryProposal(id, decision);
    if (ok) {
      await fetchProfile();
    }
  };

  const handleCompileWiki = async () => {
    setCompiling(true);
    try {
      const res = await gatewayClient.compileMemoryWiki();
      if (res?.ok) {
        setWikiResult({ path: res.path, markdown: res.markdown });
      }
    } finally {
      setCompiling(false);
    }
  };

  const handleCopyWiki = () => {
    if (wikiResult?.markdown) {
      navigator.clipboard.writeText(wikiResult.markdown);
      setCopiedWiki(true);
      setTimeout(() => setCopiedWiki(false), 2000);
    }
  };

  const pendingProposals = profileData?.pendingProposals ?? [];
  const aboutMeItems = [
    ...(profileData?.itemsByLayer?.identity ?? []),
    ...(profileData?.profile?.traits ?? []).map((t) => ({
      id: t.id,
      layer: "dialectic",
      title: `${t.dimension}`,
      content: `${t.key}: ${t.value}`,
      score: t.confidence,
    })),
  ];
  const projectNotes = profileData?.itemsByLayer?.durable ?? [];
  const alwaysFollowItems = profileData?.itemsByLayer?.constraint ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* ── TOP HEADER: SIMPLE / ADVANCED TOGGLE & REFRESH ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "2px 0",
        }}
      >
        <div
          style={{
            display: "flex",
            background: "var(--bg-chip)",
            borderRadius: "var(--radius-xs)",
            padding: "2px",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <button
            type="button"
            onClick={() => setMode("simple")}
            style={{
              padding: "3px 10px",
              borderRadius: "3px",
              border: "none",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              background: mode === "simple" ? "var(--bg-card)" : "transparent",
              color: mode === "simple" ? "var(--accent-teal)" : "var(--ink-secondary)",
              transition: "all 0.15s ease",
            }}
          >
            Simple
          </button>
          <button
            type="button"
            onClick={() => setMode("advanced")}
            style={{
              padding: "3px 10px",
              borderRadius: "3px",
              border: "none",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              background: mode === "advanced" ? "var(--bg-card)" : "transparent",
              color: mode === "advanced" ? "var(--accent-teal)" : "var(--ink-secondary)",
              transition: "all 0.15s ease",
            }}
          >
            Advanced
          </button>
        </div>

        <button
          type="button"
          onClick={fetchProfile}
          title="Refresh Memory"
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
          <RefreshIcon size={12} />
        </button>
      </div>

      {/* ── UNIFIED SEARCH BAR ── */}
      <form onSubmit={handleSearch} style={{ position: "relative" }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search memories & past chats..."
          style={{
            width: "100%",
            height: "30px",
            background: "var(--bg-card)",
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
      </form>

      {/* ── SEARCH RESULTS ── */}
      {searchResults.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--ink-muted)",
            }}
          >
            <span>SEARCH RESULTS ({searchResults.length})</span>
            <button
              type="button"
              onClick={() => setSearchResults([])}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--ink-muted)",
                cursor: "pointer",
                fontSize: "10px",
              }}
            >
              Clear
            </button>
          </div>
          {searchResults.map((item) => (
            <div
              key={item.id}
              style={{
                background: "var(--bg-card)",
                borderRadius: "var(--radius-sm)",
                padding: "8px 10px",
                border: "1px solid var(--border-subtle)",
                fontSize: "11px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "8px",
              }}
            >
              <div style={{ flex: 1 }}>
                <span
                  style={{
                    fontSize: "9.5px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: "var(--accent-teal)",
                    marginRight: "6px",
                  }}
                >
                  [{item.layer}]
                </span>
                <span style={{ color: "var(--ink-secondary)", lineHeight: 1.4 }}>{item.content}</span>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteItem(item.id)}
                title="Delete item"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--ink-muted)",
                  cursor: "pointer",
                  padding: "0 2px",
                  fontSize: "14px",
                  lineHeight: "1",
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── SUGGESTED MEMORY BANNER (VISIBLE WHEN PROPOSALS PENDING) ── */}
      {pendingProposals.length > 0 && (
        <div
          style={{
            background: "rgba(45, 212, 191, 0.08)",
            border: "1px solid rgba(45, 212, 191, 0.25)",
            borderRadius: "var(--radius-sm)",
            padding: "10px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--accent-teal)",
            }}
          >
            <SparklesIcon size={12} color="var(--accent-teal)" />
            <span>
              {pendingProposals.length} Suggested {pendingProposals.length === 1 ? "Memory" : "Memories"}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {pendingProposals.map((prop) => (
              <div
                key={prop.id}
                style={{
                  background: "var(--bg-code)",
                  padding: "6px 8px",
                  borderRadius: "var(--radius-xs)",
                  fontSize: "11px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "6px",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: "9px", color: "var(--ink-muted)", textTransform: "uppercase" }}>
                    → {prop.targetLayer}:
                  </span>
                  <div
                    style={{
                      color: "var(--ink-primary)",
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {prop.content}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => handleResolveProposal(prop.id, "approve")}
                    style={{
                      background: "var(--accent-teal)",
                      color: "#000",
                      border: "none",
                      borderRadius: "3px",
                      padding: "2px 6px",
                      fontSize: "10px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "2px",
                    }}
                  >
                    <CheckIcon size={10} color="#000" /> Save
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResolveProposal(prop.id, "dismiss")}
                    style={{
                      background: "transparent",
                      color: "var(--ink-muted)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "3px",
                      padding: "2px 6px",
                      fontSize: "10px",
                      cursor: "pointer",
                    }}
                  >
                    Ignore
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SIMPLE VIEW: 3 EVERYDAY-FRIENDLY SECTIONS ── */}
      {mode === "simple" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* 1. About Me */}
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 12px",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--ink-primary)",
                marginBottom: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>About Me ({aboutMeItems.length})</span>
              <span style={{ fontSize: "10px", color: "var(--ink-muted)", fontWeight: 400 }}>
                Persona &amp; Preferences
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "8px" }}>
              {aboutMeItems.length === 0 ? (
                <div style={{ fontSize: "11px", color: "var(--ink-muted)", fontStyle: "italic" }}>
                  No preferences recorded yet.
                </div>
              ) : (
                aboutMeItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "3px 0",
                      fontSize: "11px",
                      color: "var(--ink-secondary)",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                    }}
                  >
                    <span style={{ wordBreak: "break-word" }}>{item.content}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id)}
                      title="Remove"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--ink-muted)",
                        cursor: "pointer",
                        padding: "0 4px",
                        fontSize: "14px",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: "flex", gap: "6px" }}>
              <input
                type="text"
                value={newAboutMe}
                onChange={(e) => setNewAboutMe(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddItem("identity", newAboutMe)}
                placeholder="+ Add preference (e.g. 'Prefers TypeScript')..."
                style={{
                  flex: 1,
                  background: "var(--bg-code)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "3px",
                  padding: "4px 8px",
                  fontSize: "11px",
                  color: "var(--ink-primary)",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => handleAddItem("identity", newAboutMe)}
                disabled={!newAboutMe.trim()}
                style={{
                  padding: "0 8px",
                  borderRadius: "3px",
                  background: "var(--bg-chip)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--accent-teal)",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: newAboutMe.trim() ? "pointer" : "default",
                  opacity: newAboutMe.trim() ? 1 : 0.5,
                }}
              >
                Add
              </button>
            </div>
          </div>

          {/* 2. Project Notes */}
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 12px",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--ink-primary)",
                marginBottom: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>Project Notes ({projectNotes.length})</span>
              <span style={{ fontSize: "10px", color: "var(--ink-muted)", fontWeight: 400 }}>
                Durable Architecture
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "8px" }}>
              {projectNotes.length === 0 ? (
                <div style={{ fontSize: "11px", color: "var(--ink-muted)", fontStyle: "italic" }}>
                  No project notes saved yet.
                </div>
              ) : (
                projectNotes.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "3px 0",
                      fontSize: "11px",
                      color: "var(--ink-secondary)",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                    }}
                  >
                    <span style={{ wordBreak: "break-word" }}>{item.content}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id)}
                      title="Remove"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--ink-muted)",
                        cursor: "pointer",
                        padding: "0 4px",
                        fontSize: "14px",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: "flex", gap: "6px" }}>
              <input
                type="text"
                value={newProjectNote}
                onChange={(e) => setNewProjectNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddItem("durable", newProjectNote)}
                placeholder="+ Add project note (e.g. 'Use Bun for tests')..."
                style={{
                  flex: 1,
                  background: "var(--bg-code)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "3px",
                  padding: "4px 8px",
                  fontSize: "11px",
                  color: "var(--ink-primary)",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => handleAddItem("durable", newProjectNote)}
                disabled={!newProjectNote.trim()}
                style={{
                  padding: "0 8px",
                  borderRadius: "3px",
                  background: "var(--bg-chip)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--accent-teal)",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: newProjectNote.trim() ? "pointer" : "default",
                  opacity: newProjectNote.trim() ? 1 : 0.5,
                }}
              >
                Add
              </button>
            </div>
          </div>

          {/* 3. Always Follow */}
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 12px",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--ink-primary)",
                marginBottom: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>Always Follow ({alwaysFollowItems.length})</span>
              <span style={{ fontSize: "10px", color: "var(--ink-muted)", fontWeight: 400 }}>
                Pinned Constraints
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "8px" }}>
              {alwaysFollowItems.length === 0 ? (
                <div style={{ fontSize: "11px", color: "var(--ink-muted)", fontStyle: "italic" }}>
                  No active constraints configured.
                </div>
              ) : (
                alwaysFollowItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "3px 0",
                      fontSize: "11px",
                      color: "var(--ink-secondary)",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                    }}
                  >
                    <span style={{ wordBreak: "break-word" }}>{item.content}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id)}
                      title="Remove"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--ink-muted)",
                        cursor: "pointer",
                        padding: "0 4px",
                        fontSize: "14px",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: "flex", gap: "6px" }}>
              <input
                type="text"
                value={newAlwaysFollow}
                onChange={(e) => setNewAlwaysFollow(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddItem("constraint", newAlwaysFollow)}
                placeholder="+ Add constraint (e.g. 'Never bypass auth')..."
                style={{
                  flex: 1,
                  background: "var(--bg-code)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "3px",
                  padding: "4px 8px",
                  fontSize: "11px",
                  color: "var(--ink-primary)",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => handleAddItem("constraint", newAlwaysFollow)}
                disabled={!newAlwaysFollow.trim()}
                style={{
                  padding: "0 8px",
                  borderRadius: "3px",
                  background: "var(--bg-chip)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--accent-teal)",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: newAlwaysFollow.trim() ? "pointer" : "default",
                  opacity: newAlwaysFollow.trim() ? 1 : 0.5,
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADVANCED VIEW: 4 RAW CORY LAYERS & KNOWLEDGE WIKI COMPILER ── */}
      {mode === "advanced" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* Action Row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink-muted)" }}>
              CORY 4-LAYER KERNEL
            </span>
            <button
              type="button"
              onClick={handleCompileWiki}
              disabled={compiling}
              style={{
                background: "var(--bg-chip)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-xs)",
                padding: "3px 8px",
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--accent-teal)",
                cursor: compiling ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <SparklesIcon size={11} color="var(--accent-teal)" />
              {compiling ? "Compiling..." : "Compile Wiki"}
            </button>
          </div>

          {/* 4 Layer Stat Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <div
              style={{
                background: "var(--bg-card)",
                padding: "8px 10px",
                borderRadius: "var(--radius-xs)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ fontSize: "10px", color: "var(--ink-muted)", textTransform: "uppercase" }}>
                Identity
              </div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--ink-primary)" }}>
                {profileData?.counts?.identity ?? 0}
              </div>
            </div>
            <div
              style={{
                background: "var(--bg-card)",
                padding: "8px 10px",
                borderRadius: "var(--radius-xs)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ fontSize: "10px", color: "var(--ink-muted)", textTransform: "uppercase" }}>
                Durable
              </div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--ink-primary)" }}>
                {profileData?.counts?.durable ?? 0}
              </div>
            </div>
            <div
              style={{
                background: "var(--bg-card)",
                padding: "8px 10px",
                borderRadius: "var(--radius-xs)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ fontSize: "10px", color: "var(--ink-muted)", textTransform: "uppercase" }}>
                Constraint
              </div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--ink-primary)" }}>
                {profileData?.counts?.constraint ?? 0}
              </div>
            </div>
            <div
              style={{
                background: "var(--bg-card)",
                padding: "8px 10px",
                borderRadius: "var(--radius-xs)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ fontSize: "10px", color: "var(--ink-muted)", textTransform: "uppercase" }}>
                Episodic
              </div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--ink-primary)" }}>
                {profileData?.counts?.episodic ?? 0}
              </div>
            </div>
          </div>

          {/* Active Dialectic Traits */}
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: "var(--radius-xs)",
              padding: "10px",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink-primary)", marginBottom: "6px" }}>
              Active Dialectic Signals ({profileData?.profile?.traits?.length ?? 0})
            </div>
            {(!profileData?.profile?.traits || profileData.profile.traits.length === 0) ? (
              <div style={{ fontSize: "11px", color: "var(--ink-muted)", fontStyle: "italic" }}>
                No dialectic signals inferred yet.
              </div>
            ) : (
              profileData.profile.traits.map((trait) => (
                <div
                  key={trait.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "3px 0",
                    fontSize: "11px",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                  }}
                >
                  <span style={{ color: "var(--accent-teal)" }}>
                    <strong>{trait.key}</strong>: {trait.value}
                  </span>
                  <span style={{ color: "var(--ink-muted)", fontSize: "10px" }}>
                    {(trait.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Live Wiki Preview Modal / Drawer */}
          {wikiResult && (
            <div
              style={{
                background: "var(--bg-code)",
                borderRadius: "var(--radius-xs)",
                padding: "10px",
                border: "1px solid var(--border-subtle)",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink-primary)" }}>
                  Compiled Wiki Preview
                </span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={handleCopyWiki}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--accent-teal)",
                      cursor: "pointer",
                      fontSize: "10px",
                      display: "flex",
                      alignItems: "center",
                      gap: "2px",
                    }}
                  >
                    <CopyIcon size={11} color="var(--accent-teal)" />
                    {copiedWiki ? "Copied" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setWikiResult(null)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--ink-muted)",
                      cursor: "pointer",
                    }}
                  >
                    <CloseIcon size={11} />
                  </button>
                </div>
              </div>
              <pre
                style={{
                  maxHeight: "150px",
                  overflowY: "auto",
                  fontSize: "10.5px",
                  lineHeight: 1.45,
                  color: "var(--ink-secondary)",
                  margin: 0,
                  whiteSpace: "pre-wrap",
                }}
              >
                {wikiResult.markdown}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
