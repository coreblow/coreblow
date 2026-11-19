import React, { useState, useEffect } from "react";
import { gatewayClient } from "../../services/gateway-client";
import type { CoreHubSkill } from "../../types/gateway";
import {
  CheckIcon,
  CloseIcon,
  RefreshIcon,
  SearchIcon,
  SparklesIcon,
  TerminalIcon,
} from "../Icons";

export const CoreHubTab: React.FC = () => {
  const [storefrontItems, setStorefrontItems] = useState<CoreHubSkill[]>([]);
  const [learnedSkills, setLearnedSkills] = useState<CoreHubSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [inspectSkill, setInspectSkill] = useState<CoreHubSkill | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [storefront, learned] = await Promise.all([
        gatewayClient.getStorefront(),
        gatewayClient.getLearnedSkills(),
      ]);
      setStorefrontItems(storefront);
      setLearnedSkills(learned);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleLearned = async (skill: CoreHubSkill) => {
    setActionId(skill.id);
    try {
      const newEnabled = !skill.installed;
      await gatewayClient.toggleLearnedSkill(skill.id, newEnabled);
      await fetchData();
    } finally {
      setActionId(null);
    }
  };

  const handleInstallStorefront = async (id: string) => {
    setActionId(id);
    try {
      await gatewayClient.installStorefrontItem(id);
      await fetchData();
    } finally {
      setActionId(null);
    }
  };

  const handleUninstallStorefront = async (id: string) => {
    setActionId(id);
    try {
      await gatewayClient.uninstallStorefrontItem(id);
      await fetchData();
    } finally {
      setActionId(null);
    }
  };

  const filteredStorefront = storefrontItems.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      (item.category && item.category.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* ── TOP HEADER / REFRESH ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink-muted)", letterSpacing: "0.05em" }}>
          SKILLS &amp; 1-CLICK MARKETPLACE
        </div>
        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          title="Refresh Catalog & Skills"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--ink-muted)",
            cursor: "pointer",
            padding: "2px",
          }}
        >
          <RefreshIcon size={12} />
        </button>
      </div>

      {/* ── SECTION 1: LEARNED SKILLS (EVOLOOP) ── */}
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
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <SparklesIcon size={12} color="var(--accent-teal)" />
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink-primary)" }}>
              Learned Skills (EvoLoop)
            </span>
          </div>
          <span
            style={{
              padding: "1px 6px",
              background: "var(--bg-chip)",
              borderRadius: "4px",
              fontSize: "10px",
              fontWeight: 600,
              color: "var(--accent-teal)",
            }}
          >
            {learnedSkills.length} verified
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {learnedSkills.length === 0 ? (
            <div style={{ fontSize: "11px", color: "var(--ink-muted)", fontStyle: "italic", padding: "8px 0" }}>
              No auto-distilled skills yet. Skills automatically synthesize when multi-step tasks succeed.
            </div>
          ) : (
            learnedSkills.map((skill) => {
              const isBusy = actionId === skill.id;
              const isEnabled = skill.installed !== false;
              return (
                <div
                  key={skill.id}
                  style={{
                    background: "var(--bg-code)",
                    borderRadius: "var(--radius-xs)",
                    padding: "8px 10px",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontWeight: 600, fontSize: "11.5px", color: "var(--ink-primary)" }}>
                        {skill.name}
                      </span>
                      <span
                        style={{
                          fontSize: "9px",
                          padding: "1px 4px",
                          borderRadius: "3px",
                          background: "rgba(45, 212, 191, 0.12)",
                          color: "var(--accent-teal)",
                          fontWeight: 600,
                        }}
                      >
                        v{skill.version ?? "1.0.0"}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <button
                        type="button"
                        onClick={() => setInspectSkill(inspectSkill?.id === skill.id ? null : skill)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--ink-secondary)",
                          fontSize: "10px",
                          cursor: "pointer",
                          padding: "2px 4px",
                        }}
                      >
                        {inspectSkill?.id === skill.id ? "Hide" : "Inspect"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleLearned(skill)}
                        disabled={isBusy}
                        style={{
                          background: isEnabled ? "var(--accent-teal)" : "var(--bg-chip)",
                          color: isEnabled ? "#000" : "var(--ink-muted)",
                          border: "none",
                          borderRadius: "3px",
                          padding: "2px 6px",
                          fontSize: "10px",
                          fontWeight: 700,
                          cursor: isBusy ? "wait" : "pointer",
                        }}
                      >
                        {isEnabled ? "Enabled" : "Disabled"}
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: "10.5px", color: "var(--ink-secondary)", lineHeight: 1.4 }}>
                    {skill.description}
                  </div>

                  {inspectSkill?.id === skill.id && (
                    <div
                      style={{
                        marginTop: "6px",
                        padding: "6px 8px",
                        background: "var(--bg-card)",
                        borderRadius: "var(--radius-xs)",
                        fontSize: "10px",
                        fontFamily: "var(--font-mono)",
                        color: "var(--ink-secondary)",
                        border: "1px solid var(--border-subtle)",
                        lineHeight: 1.4,
                      }}
                    >
                      <div>
                        <strong>ID:</strong> {skill.id}
                      </div>
                      <div>
                        <strong>Category:</strong> {skill.category || "workflow"}
                      </div>
                      <div style={{ color: "var(--accent-teal)", marginTop: "4px" }}>
                        ✓ Auto-distilled &amp; patched by Cory EvoLoop Closed-Loop System
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── SECTION 2: COREHUB MARKETPLACE (1-CLICK) ── */}
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
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <TerminalIcon size={12} color="var(--accent-teal)" />
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--ink-primary)" }}>
              CoreHub Marketplace
            </span>
          </div>
          <span style={{ fontSize: "10px", color: "var(--ink-muted)" }}>
            {storefrontItems.length} catalog extensions
          </span>
        </div>

        {/* Search Input */}
        <div style={{ position: "relative" }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search catalog extensions & MCPs..."
            style={{
              width: "100%",
              height: "28px",
              background: "var(--bg-code)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-xs)",
              padding: "0 8px 0 24px",
              color: "var(--ink-primary)",
              fontSize: "11px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <span
            style={{
              position: "absolute",
              left: "6px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--ink-muted)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <SearchIcon size={12} />
          </span>
        </div>

        {/* Catalog List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "240px", overflowY: "auto" }}>
          {filteredStorefront.length === 0 ? (
            <div style={{ fontSize: "11px", color: "var(--ink-muted)", fontStyle: "italic", textAlign: "center", padding: "12px 0" }}>
              No marketplace items matched "{searchQuery}".
            </div>
          ) : (
            filteredStorefront.map((item) => {
              const isBusy = actionId === item.id;
              const isInstalled = item.installed === true;
              return (
                <div
                  key={item.id}
                  style={{
                    background: "var(--bg-code)",
                    borderRadius: "var(--radius-xs)",
                    padding: "8px 10px",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "11px",
                          color: "var(--ink-primary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.name}
                      </span>
                      <span
                        style={{
                          fontSize: "9px",
                          padding: "1px 4px",
                          background: "var(--bg-chip)",
                          color: "var(--ink-muted)",
                          borderRadius: "3px",
                        }}
                      >
                        {item.category || "Extension"}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "10.5px",
                        color: "var(--ink-secondary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        marginTop: "2px",
                      }}
                    >
                      {item.description}
                    </div>
                  </div>

                  <div style={{ flexShrink: 0 }}>
                    {isInstalled ? (
                      <button
                        type="button"
                        onClick={() => handleUninstallStorefront(item.id)}
                        disabled={isBusy}
                        style={{
                          background: "rgba(239, 68, 68, 0.15)",
                          color: "#ef4444",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          borderRadius: "3px",
                          padding: "3px 8px",
                          fontSize: "10px",
                          fontWeight: 600,
                          cursor: isBusy ? "wait" : "pointer",
                        }}
                      >
                        {isBusy ? "..." : "Uninstall"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleInstallStorefront(item.id)}
                        disabled={isBusy}
                        style={{
                          background: "var(--accent-teal)",
                          color: "#000",
                          border: "none",
                          borderRadius: "3px",
                          padding: "3px 8px",
                          fontSize: "10px",
                          fontWeight: 700,
                          cursor: isBusy ? "wait" : "pointer",
                        }}
                      >
                        {isBusy ? "..." : "1-Click Install"}
                      </button>
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
