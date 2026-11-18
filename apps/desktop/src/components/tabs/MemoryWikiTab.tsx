import React, { useState, useEffect } from "react";
import { gatewayClient } from "../../services/gateway-client";
import type { CoryMemoryItem, CoryMemoryLayer } from "../../types/gateway";
import { SearchIcon, SparklesIcon } from "../Icons";

export const MemoryWikiTab: React.FC = () => {
  const [layers, setLayers] = useState<CoryMemoryLayer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CoryMemoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    gatewayClient.getMemoryLayers().then((data) => {
      if (active) {
        if (data.length > 0) {
          setLayers(data);
        } else {
          // Fallback layers representation
          setLayers([
            { layer: "Identity & Persona", count: 12, summary: "CoreBlow v2.0 cognitive persona and sovereign rules" },
            { layer: "Architecture & Codebase", count: 48, summary: "Microkernel gateway, channel routing, tool pipelines" },
            { layer: "Episodic & Sessions", count: 35, summary: "Recent interactions, verification milestones, gates" },
            { layer: "Learned Skills & Procedures", count: 18, summary: "Autonomous ReAct loops and task execution skills" },
          ]);
        }
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setLoading(true);
    try {
      const results = await gatewayClient.searchMemory(searchQuery);
      setSearchResults(results);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Search Input */}
      <form onSubmit={handleSearch} style={{ position: "relative" }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search Cory memory layers..."
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

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink-muted)", letterSpacing: "0.05em" }}>
            SEARCH RESULTS ({searchResults.length})
          </div>
          {searchResults.map((item) => (
            <div
              key={item.id}
              style={{
                background: "var(--bg-card)",
                borderRadius: "var(--radius-sm)",
                padding: "8px 10px",
                border: "1px solid var(--border-subtle)",
                fontSize: "12px",
              }}
            >
              <div style={{ fontWeight: 600, color: "var(--accent-teal)", marginBottom: "2px" }}>
                {item.title}
              </div>
              <div style={{ color: "var(--ink-secondary)", fontSize: "11px", lineHeight: 1.4 }}>
                {item.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Memory Layers Distribution */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink-muted)", letterSpacing: "0.05em" }}>
          MEMORY LAYERS (GET /api/cory/layers)
        </div>

        {layers.map((layer) => (
          <div
            key={layer.layer}
            style={{
              background: "var(--bg-card)",
              borderRadius: "var(--radius-sm)",
              padding: "10px",
              border: "1px solid var(--border-subtle)",
              fontSize: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ fontWeight: 600, color: "var(--ink-primary)" }}>{layer.layer}</span>
              <span
                style={{
                  padding: "1px 6px",
                  borderRadius: "var(--radius-xs)",
                  background: "var(--bg-chip)",
                  color: "var(--accent-teal)",
                  fontSize: "10px",
                  fontWeight: 600,
                }}
              >
                {layer.count} items
              </span>
            </div>
            <div style={{ color: "var(--ink-secondary)", fontSize: "11px", lineHeight: 1.4 }}>
              {layer.summary}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
