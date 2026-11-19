import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { getCheckpointManager, type FileCheckpoint } from "../../security/checkpoint-manager.js";
import { inkPalette } from "./theme.js";

export type RewindMode = "code" | "conversation" | "both";

export interface RewindModalProps {
  sessionId?: string;
  onRollback: (checkpointId: string, mode: RewindMode) => void;
  onClose: () => void;
}

export const RewindModal: React.FC<RewindModalProps> = ({
  sessionId,
  onRollback,
  onClose,
}) => {
  const [checkpoints, setCheckpoints] = useState<FileCheckpoint[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    try {
      const list = getCheckpointManager().listCheckpoints(sessionId);
      setCheckpoints(list.slice(0, 8));
    } catch {
      setCheckpoints([]);
    }
  }, [sessionId]);

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }

    if (checkpoints.length === 0) {
      return;
    }

    const selected = checkpoints[selectedIndex];
    if (!selected) return;

    if (input === "c") {
      onRollback(selected.id, "code");
      return;
    }

    if (input === "m") {
      onRollback(selected.id, "conversation");
      return;
    }

    if (key.return) {
      onRollback(selected.id, "both");
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(checkpoints.length - 1, prev + 1));
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={inkPalette.accent}
      paddingX={2}
      paddingY={1}
      width={76}
    >
      <Box justifyContent="space-between">
        <Text bold color={inkPalette.accent}>
          CoreBlow Rewind & Checkpoint Restore
        </Text>
        <Text color={inkPalette.dim}>({checkpoints.length} checkpoints)</Text>
      </Box>

      <Box flexDirection="column" marginY={1}>
        {checkpoints.map((cp, idx) => {
          const isSelected = idx === selectedIndex;
          const timeStr = new Date(cp.createdAt).toLocaleTimeString();
          const targetName = cp.filePath.split(/[\\/]/).pop() || cp.filePath;

          return (
            <Box key={cp.id} justifyContent="space-between">
              <Box>
                <Text color={isSelected ? inkPalette.accent : inkPalette.dim}>
                  {isSelected ? "❯ " : "  "}
                </Text>
                <Text bold={isSelected} color={isSelected ? inkPalette.text : inkPalette.dim}>
                  {targetName}
                </Text>
                <Text color={inkPalette.dim}> [{cp.toolName}]</Text>
              </Box>
              <Text color={inkPalette.dim}>{timeStr}</Text>
            </Box>
          );
        })}
        {checkpoints.length === 0 && (
          <Text color={inkPalette.dim}>No checkpoints recorded for this session yet.</Text>
        )}
      </Box>

      <Box borderStyle="single" borderTop borderColor={inkPalette.border} justifyContent="space-between">
        <Text color={inkPalette.dim}>
          <Text bold color={inkPalette.text}>Enter</Text>: Restore Both · <Text bold color={inkPalette.text}>c</Text>: Code Only · <Text bold color={inkPalette.text}>m</Text>: Chat Only · <Text bold color={inkPalette.text}>Esc</Text>: Cancel
        </Text>
      </Box>
    </Box>
  );
};
