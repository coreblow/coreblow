import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import {
  checkSandboxAvailability,
  type SandboxMode,
} from "../../security/os-sandbox.js";
import { inkPalette } from "./theme.js";

export interface SandboxModalProps {
  currentMode: SandboxMode;
  onSelectMode: (mode: SandboxMode) => void;
  onClose: () => void;
}

export const SandboxModal: React.FC<SandboxModalProps> = ({
  currentMode,
  onSelectMode,
  onClose,
}) => {
  const modes: Array<{ id: SandboxMode; label: string; desc: string }> = [
    {
      id: "off",
      label: "Off",
      desc: "No OS-level sandboxing (default system execution)",
    },
    {
      id: "regular",
      label: "Regular Permissions",
      desc: "Isolated in cwd + /tmp, denies .coreblow and shell profiles",
    },
    {
      id: "auto-allow",
      label: "Auto-Allow Sandboxed",
      desc: "Auto-approves safe shell commands inside the sandbox boundary",
    },
  ];

  const initialIndex = Math.max(0, modes.findIndex((m) => m.id === currentMode));
  const [selectedIndex, setSelectedIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const availability = checkSandboxAvailability();

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }

    if (key.return) {
      const selected = modes[selectedIndex];
      if (selected) {
        onSelectMode(selected.id);
      }
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(modes.length - 1, prev + 1));
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
          CoreBlow OS-Level Shell Sandbox
        </Text>
        <Text color={availability.available ? inkPalette.success : inkPalette.dim}>
          [{availability.details}]
        </Text>
      </Box>

      <Box flexDirection="column" marginY={1}>
        <Text color={inkPalette.dim}>
          Restricts shell commands strictly to current workspace, denying writes to protected files (.coreblow/, shell profiles, .git/hooks).
        </Text>
      </Box>

      <Box flexDirection="column" marginY={1}>
        {modes.map((m, idx) => {
          const isSelected = idx === selectedIndex;
          const isCurrent = m.id === currentMode;
          return (
            <Box key={m.id} flexDirection="column" marginY={0}>
              <Box justifyContent="space-between">
                <Box>
                  <Text color={isSelected ? inkPalette.accent : inkPalette.dim}>
                    {isSelected ? "❯ " : "  "}
                  </Text>
                  <Text bold={isSelected} color={inkPalette.text}>
                    {m.label}
                  </Text>
                  {isCurrent && <Text color={inkPalette.success}> (active)</Text>}
                </Box>
                <Text color={inkPalette.dim}>{m.id}</Text>
              </Box>
              <Box paddingLeft={4}>
                <Text color={inkPalette.dim}>{m.desc}</Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box borderStyle="single" borderTop borderColor={inkPalette.border} justifyContent="space-between">
        <Text color={inkPalette.dim}>
          <Text bold color={inkPalette.text}>Enter</Text>: Apply Mode · <Text bold color={inkPalette.text}>Esc</Text>: Cancel
        </Text>
      </Box>
    </Box>
  );
};
