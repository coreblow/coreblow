import React, { useState } from "react";
import type { ToolExecutionStep } from "../types/gateway";
import { CheckIcon, ChevronDownIcon, TerminalIcon } from "./Icons";

interface ExecutionCardProps {
  step: ToolExecutionStep;
}

export const ExecutionCard: React.FC<ExecutionCardProps> = ({ step }) => {
  const [expanded, setExpanded] = useState(false);

  const getStatusBadge = () => {
    switch (step.status) {
      case "running":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              color: "var(--accent-teal)",
              fontSize: "11px",
              fontWeight: 500,
            }}
          >
            <span
              className="animate-spin"
              style={{
                width: "10px",
                height: "10px",
                border: "2px solid rgba(45, 212, 191, 0.2)",
                borderTopColor: "var(--accent-teal)",
                borderRadius: "50%",
                display: "inline-block",
              }}
            />
            Running
          </span>
        );
      case "done":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              color: "var(--state-success)",
              fontSize: "11px",
              fontWeight: 500,
            }}
          >
            <CheckIcon size={12} color="var(--state-success)" />
            Done
          </span>
        );
      case "error":
        return (
          <span style={{ color: "var(--state-error)", fontSize: "11px", fontWeight: 500 }}>
            Failed
          </span>
        );
      default:
        return (
          <span style={{ color: "var(--ink-muted)", fontSize: "11px" }}>
            {step.status}
          </span>
        );
    }
  };

  const hasDetails = step.input !== undefined || step.output !== undefined;

  return (
    <div
      style={{
        margin: "8px 0",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border-subtle)",
        background: "var(--bg-card)",
        overflow: "hidden",
        fontSize: "12px",
      }}
    >
      <div
        onClick={() => hasDetails && setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          cursor: hasDetails ? "pointer" : "default",
          background: expanded ? "rgba(45, 212, 191, 0.04)" : "transparent",
          transition: "background 0.15s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
          <div
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "var(--radius-xs)",
              background: "var(--bg-chip)",
              display: "grid",
              placeItems: "center",
              color: "var(--accent-teal)",
              flexShrink: 0,
            }}
          >
            <TerminalIcon size={12} />
          </div>
          <span style={{ fontWeight: 600, color: "var(--ink-primary)" }}>
            Step {step.stepIndex}: {step.tool}
          </span>
          {step.description && (
            <span
              style={{
                color: "var(--ink-secondary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "280px",
              }}
            >
              — {step.description}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          {step.durationMs !== undefined && (
            <span style={{ color: "var(--ink-muted)", fontSize: "11px" }}>
              {step.durationMs}ms
            </span>
          )}
          {getStatusBadge()}
          {hasDetails && (
            <span
              style={{
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.15s ease",
                display: "grid",
                placeItems: "center",
                color: "var(--ink-muted)",
              }}
            >
              <ChevronDownIcon size={12} />
            </span>
          )}
        </div>
      </div>

      {expanded && hasDetails && (
        <div
          style={{
            padding: "8px 12px",
            borderTop: "1px solid var(--border-subtle)",
            background: "var(--bg-code)",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            lineHeight: 1.5,
          }}
        >
          {step.input !== undefined && (
            <div style={{ marginBottom: "6px" }}>
              <div style={{ color: "var(--accent-teal)", fontWeight: 500, marginBottom: "2px" }}>
                Input:
              </div>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: "var(--ink-secondary)" }}>
                {typeof step.input === "string" ? step.input : JSON.stringify(step.input, null, 2)}
              </pre>
            </div>
          )}
          {step.output !== undefined && (
            <div>
              <div style={{ color: "var(--accent-teal)", fontWeight: 500, marginBottom: "2px" }}>
                Output:
              </div>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: "var(--ink-secondary)" }}>
                {typeof step.output === "string" ? step.output : JSON.stringify(step.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
