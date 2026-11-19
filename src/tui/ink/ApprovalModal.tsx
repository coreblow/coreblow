import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { inkPalette } from "./theme.js";

export type ApprovalDecision = "allow_once" | "allow_session" | "allow_always" | "deny";

export interface ApprovalModalProps {
  tool: string;
  commandOrPath: string;
  description?: string;
  onDecision: (decision: ApprovalDecision, comment?: string) => void;
}

export const ApprovalModal: React.FC<ApprovalModalProps> = ({
  tool,
  commandOrPath,
  description,
  onDecision,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isCommentActive, setIsCommentActive] = useState(false);
  const [comment, setComment] = useState("");

  const choices: Array<{ id: ApprovalDecision; label: string; shortcut: string }> = [
    { id: "allow_once", label: "Allow once", shortcut: "1 / o" },
    { id: "allow_session", label: "Allow for this session", shortcut: "2 / s" },
    { id: "allow_always", label: "Always allow pattern", shortcut: "3 / a" },
    { id: "deny", label: "Deny", shortcut: "4 / d / Esc" },
  ];

  useInput((input, key) => {
    // If entering steering comment
    if (isCommentActive) {
      if (key.escape) {
        setIsCommentActive(false);
        return;
      }
      if (key.return) {
        const decision = choices[selectedIndex]?.id || "deny";
        onDecision(decision, comment.trim() || undefined);
        return;
      }
      if (key.backspace || key.delete) {
        setComment((prev) => prev.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setComment((prev) => prev + input);
      }
      return;
    }

    // Toggle steering comment with Tab
    if (key.tab) {
      setIsCommentActive(true);
      return;
    }

    if (key.escape || input === "d" || input === "4") {
      onDecision("deny", comment.trim() || undefined);
      return;
    }

    if (input === "1" || input === "o") {
      onDecision("allow_once", comment.trim() || undefined);
      return;
    }

    if (input === "2" || input === "s") {
      onDecision("allow_session", comment.trim() || undefined);
      return;
    }

    if (input === "3" || input === "a") {
      onDecision("allow_always", comment.trim() || undefined);
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(choices.length - 1, prev + 1));
      return;
    }

    if (key.return) {
      const decision = choices[selectedIndex]?.id || "deny";
      onDecision(decision, comment.trim() || undefined);
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={inkPalette.accent}
      paddingX={2}
      paddingY={1}
      width={76}
    >
      <Box justifyContent="space-between">
        <Text bold color={inkPalette.accent}>
          CoreBlow Security Approval
        </Text>
        <Text color={inkPalette.dim}>[{tool}]</Text>
      </Box>

      <Box marginY={1} flexDirection="column">
        <Text bold color={inkPalette.text}>
          Action requires approval:
        </Text>
        <Text color={inkPalette.accentSoft}> {commandOrPath}</Text>
        {description && (
          <Text color={inkPalette.dim}> {description}</Text>
        )}
      </Box>

      <Box flexDirection="column" marginY={1}>
        {choices.map((c, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <Box key={c.id} justifyContent="space-between">
              <Box>
                <Text color={isSelected ? inkPalette.accent : inkPalette.dim}>
                  {isSelected ? "❯ " : "  "}
                </Text>
                <Text bold={isSelected} color={isSelected ? inkPalette.text : inkPalette.dim}>
                  {c.label}
                </Text>
              </Box>
              <Text color={inkPalette.dim}>[{c.shortcut}]</Text>
            </Box>
          );
        })}
      </Box>

      {isCommentActive ? (
        <Box flexDirection="column" borderStyle="single" borderTop borderColor={inkPalette.border} paddingTop={1}>
          <Text bold color={inkPalette.link}>
            Tell CoreBlow what to do instead (Enter to submit):
          </Text>
          <Box marginY={0}>
            <Text color={inkPalette.accent}>❯ </Text>
            <Text color={inkPalette.text}>{comment || "type instruction..."}</Text>
          </Box>
        </Box>
      ) : (
        <Box borderStyle="single" borderTop borderColor={inkPalette.border} justifyContent="space-between">
          <Text color={inkPalette.dim}>
            Press <Text bold color={inkPalette.text}>Tab</Text> to give steering instructions · <Text bold color={inkPalette.text}>Enter</Text> to confirm
          </Text>
        </Box>
      )}
    </Box>
  );
};
