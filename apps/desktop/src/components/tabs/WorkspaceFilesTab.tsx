import React, { useState, useEffect } from "react";
import type { ActiveProjectState } from "../../types/gateway";
import { gatewayClient } from "../../services/gateway-client";
import {
  CheckIcon,
  FolderIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
} from "../Icons";

export interface WorkspaceFilesTabProps {
  project: ActiveProjectState;
  onAttachFile?: (path: string) => void;
}

interface WorkspaceFileEntry {
  path: string;
  name: string;
  dir: string;
  status: "modified" | "tracked" | "checkpoint";
  size?: string;
  modifiedAt?: string;
}

const DEFAULT_WORKSPACE_FILES: WorkspaceFileEntry[] = [
  { path: "src/agents/coreblow-react-engine.ts", name: "coreblow-react-engine.ts", dir: "src/agents", status: "modified", size: "14.2 KB" },
  { path: "src/gateway/server-http.ts", name: "server-http.ts", dir: "src/gateway", status: "tracked", size: "28.6 KB" },
  { path: "src/config/schema.ts", name: "schema.ts", dir: "src/config", status: "tracked", size: "8.1 KB" },
  { path: "apps/desktop/src/App.tsx", name: "App.tsx", dir: "apps/desktop/src", status: "modified", size: "32.4 KB" },
  { path: "apps/desktop/src/components/Composer.tsx", name: "Composer.tsx", dir: "apps/desktop/src/components", status: "modified", size: "26.8 KB" },
  { path: "apps/desktop/src/components/InspectorDrawer.tsx", name: "InspectorDrawer.tsx", dir: "apps/desktop/src/components", status: "modified", size: "24.5 KB" },
  { path: "apps/desktop/src/index.css", name: "index.css", dir: "apps/desktop/src", status: "modified", size: "4.8 KB" },
  { path: "package.json", name: "package.json", dir: ".", status: "tracked", size: "3.2 KB" },
  { path: "coreblow.config.json", name: "coreblow.config.json", dir: ".", status: "tracked", size: "1.8 KB" },
];

export const WorkspaceFilesTab: React.FC<WorkspaceFilesTabProps> = ({
  project,
  onAttachFile,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [files, setFiles] = useState<WorkspaceFileEntry[]>(DEFAULT_WORKSPACE_FILES);
  const [loading, setLoading] = useState(false);
  const [attachedPaths, setAttachedPaths] = useState<Set<string>>(new Set());
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const loadCheckpoints = async () => {
    setLoading(true);
    try {
      const res = await gatewayClient.listCheckpoints();
      if (res && res.ok && Array.isArray(res.checkpoints) && res.checkpoints.length > 0) {
        const mapped: WorkspaceFileEntry[] = res.checkpoints.map((cp: { filePath?: string; path?: string; timestamp?: number }) => {
          const filePath = cp.filePath || cp.path || "workspace-file";
          const parts = filePath.split("/");
          const name = parts.pop() || filePath;
          const dir = parts.join("/") || ".";
          return {
            path: filePath,
            name,
            dir,
            status: "checkpoint",
            modifiedAt: cp.timestamp ? new Date(cp.timestamp).toLocaleTimeString() : undefined,
          };
        });
        setFiles(mapped);
      } else {
        setFiles(DEFAULT_WORKSPACE_FILES);
      }
    } catch {
      setFiles(DEFAULT_WORKSPACE_FILES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCheckpoints();
  }, [project.path]);

  const handleAddLocalFiles = async () => {
    if (window.coreblowDesktop?.dialog?.selectFiles) {
      const selected = await window.coreblowDesktop.dialog.selectFiles();
      if (selected && selected.length > 0) {
        const newEntries: WorkspaceFileEntry[] = selected.map((p) => {
          const parts = p.split("/");
          const name = parts.pop() || p;
          const dir = parts.join("/") || ".";
          return {
            path: p,
            name,
            dir,
            status: "modified",
          };
        });
        setFiles((prev) => [...newEntries, ...prev]);
        selected.forEach((p) => onAttachFile?.(p));
      }
    }
  };

  const handleAttach = (entry: WorkspaceFileEntry) => {
    onAttachFile?.(entry.path);
    setAttachedPaths((prev) => new Set(prev).add(entry.path));
    setTimeout(() => {
      setAttachedPaths((prev) => {
        const next = new Set(prev);
        next.delete(entry.path);
        return next;
      });
    }, 2500);
  };

  const handleCopyPath = async (entry: WorkspaceFileEntry) => {
    if (window.coreblowDesktop?.clipboard?.writeText) {
      await window.coreblowDesktop.clipboard.writeText(entry.path);
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(entry.path);
    }
    setCopiedPath(entry.path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const filtered = files.filter(
    (f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.path.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "14px",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Header bar: Project path, branch, add files & refresh */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
          <FolderIcon size={15} color="var(--accent-teal)" />
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--ink-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={project.path}
            >
              {project.name}
            </span>
            <span style={{ fontSize: "10px", color: "var(--ink-muted)" }}>
              branch: {project.branch}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            type="button"
            onClick={handleAddLocalFiles}
            title="Add local files to workspace"
            style={{
              height: "26px",
              padding: "0 8px",
              borderRadius: "6px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              color: "var(--ink-secondary)",
              fontSize: "11px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              cursor: "pointer",
            }}
          >
            <PlusIcon size={12} color="var(--accent-teal)" />
            <span>Add</span>
          </button>

          <button
            type="button"
            onClick={loadCheckpoints}
            title="Refresh workspace files"
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "6px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              color: "var(--ink-secondary)",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            <RefreshIcon size={12} />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div style={{ position: "relative", marginBottom: "10px" }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter workspace files..."
          style={{
            width: "100%",
            height: "30px",
            background: "var(--bg-input)",
            border: "1px solid var(--border-medium)",
            borderRadius: "6px",
            padding: "0 8px 0 28px",
            color: "var(--ink-primary)",
            fontSize: "11px",
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

      {/* File List */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              padding: "24px 12px",
              textAlign: "center",
              color: "var(--ink-muted)",
              fontSize: "12px",
            }}
          >
            {loading ? "Scanning workspace files..." : "No matching workspace files found"}
          </div>
        ) : (
          filtered.map((file) => {
            const isAttached = attachedPaths.has(file.path);
            const isCopied = copiedPath === file.path;
            return (
              <div
                key={file.path}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  transition: "background 0.12s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                  <FolderIcon size={13} color="var(--accent-teal)" />
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 500,
                        color: "var(--ink-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={file.path}
                    >
                      {file.name}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "var(--ink-muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {file.dir} {file.size ? `· ${file.size}` : ""}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => handleCopyPath(file)}
                    title="Copy relative file path"
                    style={{
                      height: "22px",
                      padding: "0 6px",
                      borderRadius: "4px",
                      background: "transparent",
                      border: "1px solid var(--border-subtle)",
                      color: isCopied ? "var(--state-success)" : "var(--ink-muted)",
                      fontSize: "10px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "3px",
                    }}
                  >
                    {isCopied ? <CheckIcon size={10} color="var(--state-success)" /> : null}
                    <span>{isCopied ? "Copied" : "Copy"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAttach(file)}
                    title="Attach file to active chat prompt"
                    style={{
                      height: "22px",
                      padding: "0 8px",
                      borderRadius: "4px",
                      background: isAttached ? "var(--accent-teal-subtle)" : "var(--bg-chip)",
                      border: isAttached
                        ? "1px solid var(--accent-teal)"
                        : "1px solid var(--border-subtle)",
                      color: isAttached ? "var(--accent-teal)" : "var(--ink-secondary)",
                      fontSize: "10px",
                      fontWeight: 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "3px",
                    }}
                  >
                    {isAttached ? <CheckIcon size={10} color="var(--accent-teal)" /> : null}
                    <span>{isAttached ? "Attached" : "Attach"}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
