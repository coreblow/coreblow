import React from "react";
import { Box, Text } from "ink";
import { inkPalette } from "./theme.js";

export interface ToolCallItem {
  id: string;
  name: string;
  target?: string;
  status: "running" | "success" | "error";
  durationMs?: number;
  linesAdded?: number;
  linesRemoved?: number;
  outputPreview?: string;
}

export interface ToolRowProps {
  tool: ToolCallItem;
  expanded?: boolean;
}

export function formatDuration(ms?: number): string {
  if (ms === undefined || ms < 0) return "";
  const sec = (ms / 1000).toFixed(1);
  return `${sec}s`;
}

export const ToolRow: React.FC<ToolRowProps> = ({ tool, expanded = false }) => {
  const icon =
    tool.status === "running"
      ? "⠹"
      : tool.status === "success"
        ? "✓"
        : "✗";

  const iconColor =
    tool.status === "running"
      ? inkPalette.accent
      : tool.status === "success"
        ? inkPalette.success
        : inkPalette.error;

  const durationStr = formatDuration(tool.durationMs);
  const diffBadge =
    (tool.linesAdded !== undefined && tool.linesAdded > 0) ||
    (tool.linesRemoved !== undefined && tool.linesRemoved > 0)
      ? ` +${tool.linesAdded || 0} -${tool.linesRemoved || 0}`
      : "";

  return (
    <Box flexDirection="column" marginY={0}>
      <Box justifyContent="space-between">
        <Box>
          <Text bold color={iconColor}>
            {icon}{" "}
          </Text>
          <Text bold color={inkPalette.text}>
            {tool.name}
          </Text>
          {tool.target && (
            <Text color={inkPalette.dim}> {tool.target}</Text>
          )}
          {diffBadge && (
            <Text color={inkPalette.link}>{diffBadge}</Text>
          )}
        </Box>
        {durationStr && (
          <Text color={inkPalette.dim}>· {durationStr}</Text>
        )}
      </Box>

      {expanded && tool.outputPreview && (
        <Box paddingLeft={2} marginY={0}>
          <Text color={inkPalette.dim}>{tool.outputPreview.slice(0, 300)}</Text>
        </Box>
      )}
    </Box>
  );
};

export interface TurnSummaryRuleProps {
  durationMs?: number;
  toolsCount?: number;
  filesEdited?: number;
}

export const TurnSummaryRule: React.FC<TurnSummaryRuleProps> = ({
  durationMs = 0,
  toolsCount = 0,
  filesEdited = 0,
}) => {
  const parts = [
    formatDuration(durationMs),
    toolsCount > 0 ? `${toolsCount} tool${toolsCount > 1 ? "s" : ""} used` : null,
    filesEdited > 0 ? `${filesEdited} file${filesEdited > 1 ? "s" : ""} edited` : null,
  ].filter(Boolean);

  const text = parts.length > 0 ? `── ${parts.join(" · ")} ──` : "────";

  return (
    <Box marginY={0}>
      <Text color={inkPalette.dim}>{text}</Text>
    </Box>
  );
};
