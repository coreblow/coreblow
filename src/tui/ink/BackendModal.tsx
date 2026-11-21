import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import {
  probeBackendAvailability,
  type ExecutionBackendType,
  type BackendProbeResult,
  type ExecutionBackendConfig,
} from "../../execution/execution-backend.js";
import { inkPalette } from "./theme.js";

export interface BackendModalProps {
  currentConfig: ExecutionBackendConfig;
  onSelectBackend: (config: ExecutionBackendConfig, saveDefault: boolean) => void;
  onClose: () => void;
}

const BACKEND_DEFS: Array<{
  type: ExecutionBackendType;
  label: string;
  defaultTarget?: string;
  placeholder: string;
}> = [
  { type: "local", label: "Local Host Shell", placeholder: "" },
  { type: "sandbox", label: "OS-Level Sandbox", placeholder: "" },
  { type: "docker", label: "Docker Container", defaultTarget: "node:22-slim", placeholder: "image (e.g. node:22-slim)" },
  { type: "ssh", label: "Remote SSH Host", placeholder: "host (e.g. user@prod-box)" },
  { type: "node", label: "CoreBlow Paired Remote Node", placeholder: "node-id" },
  { type: "cloud", label: "Remote Cloud Sandbox", placeholder: "https://cloud-runner.example.com" },
];

export const BackendModal: React.FC<BackendModalProps> = ({
  currentConfig,
  onSelectBackend,
  onClose,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(
      0,
      BACKEND_DEFS.findIndex((b) => b.type === currentConfig.type),
    ),
  );
  const [probes, setProbes] = useState<Record<string, BackendProbeResult>>({});
  const [targetInput, setTargetInput] = useState(currentConfig.target || "");
  const [isEditingTarget, setIsEditingTarget] = useState(false);

  const selectedDef = BACKEND_DEFS[selectedIndex] || BACKEND_DEFS[0]!;

  // Probe availability on mount
  useEffect(() => {
    let unmounted = false;
    for (const def of BACKEND_DEFS) {
      void probeBackendAvailability(def.type, {
        type: def.type,
        target: currentConfig.type === def.type ? currentConfig.target : def.defaultTarget,
      }).then((res) => {
        if (!unmounted) {
          setProbes((prev) => ({ ...prev, [def.type]: res }));
        }
      });
    }
    return () => {
      unmounted = true;
    };
  }, [currentConfig]);

  // Update target input when selection changes
  useEffect(() => {
    if (selectedDef.type === currentConfig.type) {
      setTargetInput(currentConfig.target || selectedDef.defaultTarget || "");
    } else {
      setTargetInput(selectedDef.defaultTarget || "");
    }
    setIsEditingTarget(false);
  }, [selectedIndex, selectedDef, currentConfig]);

  useInput((input, key) => {
    // Target editing mode
    if (isEditingTarget) {
      if (key.escape) {
        setIsEditingTarget(false);
        return;
      }
      if (key.return) {
        setIsEditingTarget(false);
        const newConfig: ExecutionBackendConfig = {
          type: selectedDef.type,
          target: targetInput.trim() || undefined,
        };
        onSelectBackend(newConfig, false);
        return;
      }
      if (key.backspace || key.delete) {
        setTargetInput((prev) => prev.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setTargetInput((prev) => prev + input);
      }
      return;
    }

    // Normal navigation mode
    if (key.escape) {
      onClose();
      return;
    }

    if (input === "e" && selectedDef.placeholder) {
      setIsEditingTarget(true);
      return;
    }

    if (key.return) {
      const newConfig: ExecutionBackendConfig = {
        type: selectedDef.type,
        target: targetInput.trim() || undefined,
      };
      onSelectBackend(newConfig, false);
      return;
    }

    if (input === "d") {
      const newConfig: ExecutionBackendConfig = {
        type: selectedDef.type,
        target: targetInput.trim() || undefined,
      };
      onSelectBackend(newConfig, true);
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(BACKEND_DEFS.length - 1, prev + 1));
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
          CoreBlow Execution Backends
        </Text>
        <Text color={inkPalette.dim}>
          Active: [{currentConfig.type}]
        </Text>
      </Box>

      <Box flexDirection="column" marginY={1}>
        <Text color={inkPalette.dim}>
          Select per-session shell & tool execution target (Docker, SSH, Node, Sandbox, Local):
        </Text>
      </Box>

      {/* Backend List */}
      <Box flexDirection="column" marginY={0}>
        {BACKEND_DEFS.map((b, idx) => {
          const isSelected = idx === selectedIndex;
          const isCurrent = b.type === currentConfig.type;
          const probe = probes[b.type];

          let probeIcon = "○";
          let probeColor: string = inkPalette.dim;
          if (probe) {
            if (probe.status === "available") {
              probeIcon = "✓";
              probeColor = inkPalette.success;
            } else if (probe.status === "unconfigured") {
              probeIcon = "○";
              probeColor = inkPalette.accentSoft;
            } else {
              probeIcon = "✗";
              probeColor = inkPalette.error;
            }
          }

          return (
            <Box key={b.type} flexDirection="column" marginY={0}>
              <Box justifyContent="space-between">
                <Box>
                  <Text color={isSelected ? inkPalette.accent : inkPalette.dim}>
                    {isSelected ? "❯ " : "  "}
                  </Text>
                  <Text bold={isSelected} color={inkPalette.text}>
                    {b.label}
                  </Text>
                  {isCurrent && <Text color={inkPalette.success}> (active)</Text>}
                </Box>
                <Text color={probeColor}>
                  {probeIcon} {probe ? probe.status : "probing..."}
                </Text>
              </Box>
              <Box paddingLeft={4}>
                <Text color={inkPalette.dim}>{probe ? probe.details : b.type}</Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Target input field */}
      {selectedDef.placeholder && (
        <Box
          flexDirection="column"
          borderStyle="single"
          borderTop
          borderColor={inkPalette.border}
          marginTop={1}
          paddingTop={0}
        >
          <Box justifyContent="space-between">
            <Text color={inkPalette.accentSoft}>
              Target: {selectedDef.placeholder}
            </Text>
            <Text color={inkPalette.dim}>
              {isEditingTarget ? "(editing... Enter to save)" : "('e' to edit)"}
            </Text>
          </Box>
          <Box>
            <Text color={inkPalette.accent}>❯ </Text>
            <Text color={isEditingTarget ? inkPalette.text : inkPalette.dim}>
              {targetInput || "(none)"}
            </Text>
          </Box>
        </Box>
      )}

      {/* Actions footer */}
      <Box
        borderStyle="single"
        borderTop
        borderColor={inkPalette.border}
        marginTop={1}
        justifyContent="space-between"
      >
        <Text color={inkPalette.dim}>
          <Text bold color={inkPalette.text}>Enter</Text>: Apply · <Text bold color={inkPalette.text}>e</Text>: Edit Target · <Text bold color={inkPalette.text}>d</Text>: Set Default · <Text bold color={inkPalette.text}>Esc</Text>: Cancel
        </Text>
      </Box>
    </Box>
  );
};
