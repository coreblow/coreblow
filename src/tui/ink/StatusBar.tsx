import React from "react";
import { Box, Text } from "ink";
import process from "node:process";
import {
  calculateContextMetrics,
  type ContextMetrics,
} from "./context-telemetry.js";
import {
  getPermissionModeBadge,
  type PermissionMode,
} from "./input-prefixes.js";
import { inkPalette } from "./theme.js";

export interface StatusBarProps {
  model: string;
  provider?: string;
  permissionMode: PermissionMode;
  backendBadge: string;
  uiMode?: "basic" | "pro";
  usedTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  maxTokens?: number;
  isBusy?: boolean;
  statusMsg?: string | null;
  columns?: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  model,
  provider,
  permissionMode,
  backendBadge,
  uiMode = "pro",
  usedTokens = 0,
  inputTokens,
  outputTokens,
  maxTokens,
  isBusy = false,
  statusMsg,
  columns = process.stdout.columns || 80,
}) => {
  const metrics: ContextMetrics = calculateContextMetrics({
    usedTokens,
    inputTokens,
    outputTokens,
    maxTokens,
    provider,
  });

  const modeBadge = getPermissionModeBadge(permissionMode);
  const modelShortName = model.split("/").pop() || model;

  // Basic Mode
  if (uiMode === "basic") {
    return (
      <Box paddingX={1} justifyContent="space-between">
        <Text color={inkPalette.dim}>
          Shift+Tab {modeBadge.label} · Ctrl+P sessions
        </Text>
        <Text color={inkPalette.dim}>
          {modelShortName} · {backendBadge}
        </Text>
      </Box>
    );
  }

  // Minimal (< 56 columns)
  if (columns < 56) {
    return (
      <Box paddingX={1} justifyContent="space-between">
        <Text color={inkPalette.text}>
          {modelShortName} ·{" "}
          <Text color={metrics.color}>{metrics.percentage}%</Text>
        </Text>
        {isBusy && (
          <Text color={inkPalette.accent}>
            ⠹
          </Text>
        )}
      </Box>
    );
  }

  // Compact (56 - 79 columns)
  if (columns < 80) {
    return (
      <Box paddingX={1} justifyContent="space-between">
        <Box>
          <Text color={inkPalette.text}>{modelShortName} </Text>
          <Text color={modeBadge.color}>[{modeBadge.label}] </Text>
          <Text color={metrics.color}>{metrics.percentage}% </Text>
          <Text color={inkPalette.dim}>· ${metrics.costUsd.toFixed(2)}</Text>
          {isBusy && (
            <Text color={inkPalette.accent}> · ⠹ {statusMsg || "busy"}</Text>
          )}
        </Box>
      </Box>
    );
  }

  // Full (>= 80 columns)
  return (
    <Box paddingX={1} justifyContent="space-between">
      <Box>
        <Text color={inkPalette.text}>
          {modelShortName}{" "}
        </Text>
        <Text color={modeBadge.color}>[{modeBadge.label}] · </Text>
        <Text color={inkPalette.dim}>
          {metrics.formattedUsed}/{metrics.formattedMax}{" "}
        </Text>
        <Text color={metrics.color}>
          {metrics.bar} {metrics.percentage}%{" "}
        </Text>
        <Text color={inkPalette.dim}>
          · ${metrics.costUsd.toFixed(2)}
        </Text>
        {isBusy && (
          <Text color={inkPalette.accent}> · ⠹ {statusMsg || "busy"}</Text>
        )}
      </Box>
      <Text color={inkPalette.dim}>
        {backendBadge} · /help
      </Text>
    </Box>
  );
};
