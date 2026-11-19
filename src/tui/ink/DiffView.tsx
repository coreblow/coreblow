import React from "react";
import { Box, Text } from "ink";
import { inkPalette } from "./theme.js";

export type DiffLineType = "add" | "del" | "hunk" | "meta" | "context";

export interface DiffLine {
  type: DiffLineType;
  text: string;
}

/**
 * Classifies a line of unified diff.
 */
export function classifyDiffLine(line: string): DiffLine {
  if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff --git") || line.startsWith("index ")) {
    return { type: "meta", text: line };
  }
  if (line.startsWith("@@")) {
    return { type: "hunk", text: line };
  }
  if (line.startsWith("+")) {
    return { type: "add", text: line };
  }
  if (line.startsWith("-")) {
    return { type: "del", text: line };
  }
  return { type: "context", text: line };
}

/**
 * Parses raw unified diff string into classified DiffLine array.
 */
export function parseUnifiedDiff(rawDiff: string): DiffLine[] {
  if (!rawDiff.trim()) return [];
  return rawDiff.split("\n").map(classifyDiffLine);
}

export interface DiffViewProps {
  diff: string;
  maxLines?: number;
  title?: string;
  onClose?: () => void;
}

export const DiffView: React.FC<DiffViewProps> = ({
  diff,
  maxLines = 18,
  title = "CoreBlow Session Diff",
}) => {
  const lines = parseUnifiedDiff(diff);
  const visible = lines.slice(0, maxLines);
  const remaining = lines.length - visible.length;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={inkPalette.accent}
      paddingX={1}
      paddingY={0}
      width={76}
    >
      <Box justifyContent="space-between" borderStyle="single" borderBottom borderColor={inkPalette.border}>
        <Text bold color={inkPalette.accent}>
          {title}
        </Text>
        <Text color={inkPalette.dim}>({lines.length} lines)</Text>
      </Box>

      <Box flexDirection="column" marginY={0}>
        {visible.map((l, i) => {
          let color: string = inkPalette.dim;
          if (l.type === "add") color = inkPalette.success;
          if (l.type === "del") color = inkPalette.error;
          if (l.type === "hunk") color = inkPalette.link;
          if (l.type === "meta") color = inkPalette.accentSoft;

          return (
            <Text key={i} color={color}>
              {l.text}
            </Text>
          );
        })}
        {lines.length === 0 && (
          <Text color={inkPalette.dim}>(no changes detected)</Text>
        )}
        {remaining > 0 && (
          <Text color={inkPalette.dim}>... {remaining} more lines</Text>
        )}
      </Box>

      <Box borderStyle="single" borderTop borderColor={inkPalette.border}>
        <Text color={inkPalette.dim}>Press Esc to close</Text>
      </Box>
    </Box>
  );
};
