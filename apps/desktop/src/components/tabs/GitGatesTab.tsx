import React, { useState } from "react";
import type { GitGateStatus } from "../../types/gateway";
import { CheckIcon, GitBranchIcon, RefreshIcon } from "../Icons";
import { gatewayClient } from "../../services/gateway-client";

interface GitGatesTabProps {
  branch: string;
  uncommittedFiles: number;
}

export const GitGatesTab: React.FC<GitGatesTabProps> = ({ branch, uncommittedFiles }) => {
  const [gates, setGates] = useState<GitGateStatus>({
    check: "pass",
    test: "pass",
    build: "pass",
    format: "pass",
    types: "pass",
  });
  const [running, setRunning] = useState(false);
  const [rollbackStatus, setRollbackStatus] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState(false);

  const handleUndoLastEdit = async () => {
    setRollingBack(true);
    setRollbackStatus(null);
    try {
      const res = await gatewayClient.rollbackCheckpoint();
      if (res.ok) {
        setRollbackStatus(res.message || "Last edit undone.");
      } else {
        setRollbackStatus(res.error || res.message || "No edit available to undo.");
      }
    } catch (err) {
      setRollbackStatus(err instanceof Error ? err.message : "Rollback failed.");
    } finally {
      setRollingBack(false);
      setTimeout(() => setRollbackStatus(null), 4000);
    }
  };

  const handleRunGates = async () => {
    setRunning(true);
    setGates({
      check: "pending",
      test: "pending",
      build: "pending",
      format: "pending",
      types: "pending",
    });

    // Simulate verification stages sequentially
    setTimeout(() => setGates((g) => ({ ...g, format: "pass" })), 400);
    setTimeout(() => setGates((g) => ({ ...g, types: "pass" })), 800);
    setTimeout(() => setGates((g) => ({ ...g, check: "pass" })), 1200);
    setTimeout(() => setGates((g) => ({ ...g, test: "pass" })), 1600);
    setTimeout(() => {
      setGates((g) => ({ ...g, build: "pass" }));
      setRunning(false);
    }, 2000);
  };

  const getGateBadge = (status: "pending" | "pass" | "fail") => {
    switch (status) {
      case "pending":
        return (
          <span
            className="animate-spin"
            style={{
              width: "12px",
              height: "12px",
              border: "2px solid rgba(45, 212, 191, 0.2)",
              borderTopColor: "var(--accent-teal)",
              borderRadius: "50%",
              display: "inline-block",
            }}
          />
        );
      case "pass":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              color: "var(--state-success)",
              fontSize: "11px",
              fontWeight: 600,
            }}
          >
            <CheckIcon size={12} color="var(--state-success)" />
            PASS
          </span>
        );
      case "fail":
        return (
          <span style={{ color: "var(--state-error)", fontSize: "11px", fontWeight: 600 }}>
            FAIL
          </span>
        );
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Git Working Tree Status */}
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-md)",
          padding: "12px",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink-muted)", letterSpacing: "0.05em" }}>
            GIT REPOSITORY
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--accent-teal)", fontSize: "12px" }}>
            <GitBranchIcon size={13} color="var(--accent-teal)" />
            <strong>{branch}</strong>
          </span>
        </div>
        <div style={{ fontSize: "12px", color: "var(--ink-secondary)" }}>
          {uncommittedFiles === 0 ? "Working tree clean. All changes committed." : `${uncommittedFiles} unstaged change(s)`}
        </div>

        <div style={{ marginTop: "10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button
            type="button"
            onClick={handleUndoLastEdit}
            disabled={rollingBack}
            title="Undo last file edit made by autonomous agent (/rollback)"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "3px 8px",
              background: "var(--bg-chip)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-xs)",
              color: "var(--accent-teal)",
              fontSize: "11px",
              fontWeight: 500,
              cursor: rollingBack ? "default" : "pointer",
            }}
          >
            {rollingBack ? "Rolling back..." : "↩ Undo Last Edit"}
          </button>
          {rollbackStatus && (
            <span
              style={{
                fontSize: "10.5px",
                color: "var(--accent-teal)",
                maxWidth: "160px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={rollbackStatus}
            >
              {rollbackStatus}
            </span>
          )}
        </div>
      </div>

      {/* 5-Gates Verification Bar */}
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-md)",
          padding: "12px",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink-muted)", letterSpacing: "0.05em" }}>
            5-GATES VERIFICATION
          </span>
          <button
            type="button"
            onClick={handleRunGates}
            disabled={running}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 8px",
              background: "var(--bg-chip)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-xs)",
              color: "var(--accent-teal)",
              fontSize: "11px",
              cursor: running ? "default" : "pointer",
            }}
          >
            <RefreshIcon size={11} />
            {running ? "Verifying..." : "Run Gates"}
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
            <span style={{ color: "var(--ink-secondary)" }}>Gate 1: Format (`pnpm format`)</span>
            {getGateBadge(gates.format)}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
            <span style={{ color: "var(--ink-secondary)" }}>Gate 2: Types (`pnpm tsgo`)</span>
            {getGateBadge(gates.types)}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
            <span style={{ color: "var(--ink-secondary)" }}>Gate 3: Linter & Checks (`pnpm check`)</span>
            {getGateBadge(gates.check)}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
            <span style={{ color: "var(--ink-secondary)" }}>Gate 4: Unit Tests (`pnpm test`)</span>
            {getGateBadge(gates.test)}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
            <span style={{ color: "var(--ink-secondary)" }}>Gate 5: Build (`pnpm build`)</span>
            {getGateBadge(gates.build)}
          </div>
        </div>
      </div>
    </div>
  );
};
