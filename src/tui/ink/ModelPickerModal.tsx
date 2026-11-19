import React, { useState, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import {
  cycleReasoningEffort,
  normalizeModelId,
  splitModelRef,
  type ReasoningEffort,
} from "./model-picker-utils.js";
import { inkPalette } from "./theme.js";
import type { TuiModelChoice } from "../tui-backend.js";

export interface ModelPickerModalProps {
  models: TuiModelChoice[];
  currentModel?: string;
  currentEffort?: ReasoningEffort;
  onSelect: (modelId: string, effort: ReasoningEffort, saveDefault: boolean) => void;
  onClose: () => void;
}

const CURATED_MODELS: TuiModelChoice[] = [
  { id: "anthropic/claude-3-7-sonnet", name: "Claude 3.7 Sonnet (Hybrid)", provider: "anthropic", reasoning: true },
  { id: "anthropic/claude-3-5-sonnet", name: "Claude 3.5 Sonnet", provider: "anthropic" },
  { id: "anthropic/claude-3-5-haiku", name: "Claude 3.5 Haiku", provider: "anthropic" },
  { id: "openai/gpt-4o", name: "GPT-4o (Omni)", provider: "openai" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "openai" },
  { id: "openai/o3-mini", name: "o3-mini (Reasoning)", provider: "openai", reasoning: true },
  { id: "gemini/gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "gemini" },
  { id: "gemini/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "gemini" },
  { id: "openrouter/anthropic/claude-3.7-sonnet", name: "Claude 3.7 Sonnet (via OpenRouter)", provider: "openrouter", reasoning: true },
  { id: "openrouter/deepseek/deepseek-r1", name: "DeepSeek R1 (via OpenRouter)", provider: "openrouter", reasoning: true },
  { id: "ollama/llama3.3", name: "Llama 3.3 (Local Ollama)", provider: "ollama" },
  { id: "ollama/qwen2.5-coder", name: "Qwen 2.5 Coder (Local Ollama)", provider: "ollama" },
  { id: "coreblow/native", name: "CoreBlow Native Agent", provider: "coreblow" },
];

export const ModelPickerModal: React.FC<ModelPickerModalProps> = ({
  models,
  currentModel = "coreblow/native",
  currentEffort = "off",
  onSelect,
  onClose,
}) => {
  const [filter, setFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [effort, setEffort] = useState<ReasoningEffort>(currentEffort);

  // Merge provided models with curated defaults if list is short
  const allModels = useMemo(() => {
    const list: TuiModelChoice[] = [];
    const seen = new Set<string>();

    const addModel = (m: TuiModelChoice) => {
      const normalizedId = normalizeModelId(m.provider, m.id);
      if (!seen.has(normalizedId)) {
        seen.add(normalizedId);
        list.push({ ...m, id: normalizedId });
      }
    };

    for (const m of models) addModel(m);
    for (const m of CURATED_MODELS) addModel(m);

    return list;
  }, [models]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return allModels;
    return allModels.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q),
    );
  }, [allModels, filter]);

  const safeIndex = Math.min(Math.max(0, selectedIndex), Math.max(0, filtered.length - 1));

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }

    if (key.return) {
      const selected = filtered[safeIndex];
      if (selected) {
        onSelect(selected.id, effort, true);
      }
      return;
    }

    if (input === "s" && filter.length === 0) {
      const selected = filtered[safeIndex];
      if (selected) {
        onSelect(selected.id, effort, false);
      }
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(filtered.length - 1, prev + 1));
      return;
    }

    if (key.leftArrow) {
      setEffort((prev) => cycleReasoningEffort(prev, "left"));
      return;
    }

    if (key.rightArrow) {
      setEffort((prev) => cycleReasoningEffort(prev, "right"));
      return;
    }

    if (key.backspace || key.delete) {
      setFilter((prev) => prev.slice(0, -1));
      setSelectedIndex(0);
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      setFilter((prev) => prev + input);
      setSelectedIndex(0);
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={inkPalette.accent}
      paddingX={1}
      paddingY={0}
      width={72}
    >
      <Box justifyContent="space-between">
        <Text bold color={inkPalette.accent}>
          CoreBlow Model Switcher
        </Text>
        <Text color={inkPalette.dim}>
          Reasoning Effort: [
          <Text bold color={inkPalette.accentSoft}>
            ◀ {effort} ▶
          </Text>
          ]
        </Text>
      </Box>

      <Box marginY={0}>
        <Text color={inkPalette.dim}>Search: </Text>
        <Text color={inkPalette.text}>{filter || "type to filter..."}</Text>
      </Box>

      <Box flexDirection="column" marginY={1}>
        {filtered.slice(0, 10).map((m, idx) => {
          const isSelected = idx === safeIndex;
          const isCurrent = normalizeModelId(m.provider, m.id) === currentModel;
          const { provider } = splitModelRef(m.id);

          return (
            <Box key={m.id} justifyContent="space-between">
              <Box>
                <Text color={isSelected ? inkPalette.accent : inkPalette.dim}>
                  {isSelected ? "❯ " : "  "}
                </Text>
                <Text bold={isSelected} color={isSelected ? inkPalette.text : inkPalette.dim}>
                  {m.id}
                </Text>
                {isCurrent && <Text color={inkPalette.success}> (active)</Text>}
              </Box>
              <Text color={inkPalette.accentSoft}>[{provider}]</Text>
            </Box>
          );
        })}
        {filtered.length === 0 && (
          <Text color={inkPalette.dim}>No models match "{filter}"</Text>
        )}
      </Box>

      <Box borderStyle="single" borderTop borderColor={inkPalette.border} justifyContent="space-between">
        <Text color={inkPalette.dim}>
          <Text bold color={inkPalette.text}>Enter</Text>: Set Default · <Text bold color={inkPalette.text}>s</Text>: Session Only · <Text bold color={inkPalette.text}>◀▶</Text>: Effort · <Text bold color={inkPalette.text}>Esc</Text>: Cancel
        </Text>
      </Box>
    </Box>
  );
};
