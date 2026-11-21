import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { saveProviderSetup, type ProviderSetupParams } from "../../cli/setup-state.js";
import { inkPalette } from "./theme.js";

export interface FirstRunWizardProps {
  onComplete: (setup: ProviderSetupParams) => void;
  onCancel?: () => void;
}

type WizardStep = "mode_theme" | "provider" | "credentials" | "model" | "saving";

const PROVIDERS = [
  { id: "anthropic", label: "Anthropic", envVar: "ANTHROPIC_API_KEY", placeholder: "sk-ant-api03-..." },
  { id: "openai", label: "OpenAI", envVar: "OPENAI_API_KEY", placeholder: "sk-proj-..." },
  { id: "gemini", label: "Google Gemini", envVar: "GEMINI_API_KEY", placeholder: "AIzaSy..." },
  { id: "openrouter", label: "OpenRouter", envVar: "OPENROUTER_API_KEY", placeholder: "sk-or-v1-..." },
  { id: "ollama", label: "Ollama (Local)", envVar: "OLLAMA_HOST", placeholder: "http://localhost:11434" },
  { id: "custom", label: "Custom OpenAI-Compatible Endpoint", envVar: "COREBLOW_CUSTOM_BASE_URL", placeholder: "https://my-llm.local/v1" },
];

const CURATED_MODELS_BY_PROVIDER: Record<string, string[]> = {
  anthropic: [
    "anthropic/claude-3-7-sonnet",
    "anthropic/claude-3-5-sonnet",
    "anthropic/claude-3-5-haiku",
  ],
  openai: [
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
    "openai/o3-mini",
  ],
  gemini: [
    "gemini/gemini-2.0-flash",
    "gemini/gemini-2.5-flash",
  ],
  openrouter: [
    "openrouter/anthropic/claude-3.7-sonnet",
    "openrouter/deepseek/deepseek-r1",
    "openrouter/openai/gpt-4o",
  ],
  ollama: [
    "ollama/llama3.3",
    "ollama/qwen2.5-coder",
    "ollama/deepseek-r1",
  ],
  custom: [
    "custom/default",
  ],
};

export const FirstRunWizard: React.FC<FirstRunWizardProps> = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState<WizardStep>("mode_theme");
  const [mode, setMode] = useState<"basic" | "pro">("pro");
  const [theme, setTheme] = useState<"auto" | "dark" | "light">("auto");
  const [providerIndex, setProviderIndex] = useState(0);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [modelIndex, setModelIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedProvider = PROVIDERS[providerIndex] || PROVIDERS[0]!;
  const availableModels = CURATED_MODELS_BY_PROVIDER[selectedProvider.id] || ["coreblow/native"];

  useInput((input, key) => {
    if (key.escape && onCancel) {
      onCancel();
      return;
    }

    // Step 1: Mode & Theme
    if (step === "mode_theme") {
      if (key.leftArrow || key.rightArrow) {
        setMode((prev) => (prev === "pro" ? "basic" : "pro"));
      } else if (key.upArrow || key.downArrow) {
        setTheme((prev) => (prev === "auto" ? "dark" : prev === "dark" ? "light" : "auto"));
      } else if (key.return) {
        setStep("provider");
      }
      return;
    }

    // Step 2: Provider selection
    if (step === "provider") {
      if (key.upArrow) {
        setProviderIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setProviderIndex((prev) => Math.min(PROVIDERS.length - 1, prev + 1));
      } else if (key.return) {
        if (selectedProvider.id === "ollama") {
          setBaseUrl("http://localhost:11434");
          setStep("model");
        } else {
          setStep("credentials");
        }
      }
      return;
    }

    // Step 3: Credentials input
    if (step === "credentials") {
      if (key.return) {
        if (!apiKey.trim() && selectedProvider.id !== "custom") {
          setErrorMsg("API Key cannot be empty");
          return;
        }
        setErrorMsg(null);
        setStep("model");
        return;
      }

      if (key.backspace || key.delete) {
        setApiKey((prev) => prev.slice(0, -1));
        return;
      }

      if (input && !key.ctrl && !key.meta) {
        setApiKey((prev) => prev + input);
      }
      return;
    }

    // Step 4: Model selection & Save
    if (step === "model") {
      if (key.upArrow) {
        setModelIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setModelIndex((prev) => Math.min(availableModels.length - 1, prev + 1));
      } else if (key.return) {
        const chosenModel = availableModels[modelIndex] || availableModels[0]!;
        setStep("saving");
        const setupParams: ProviderSetupParams = {
          provider: selectedProvider.id,
          apiKey: apiKey.trim() || undefined,
          baseUrl: baseUrl.trim() || undefined,
          model: chosenModel,
          theme,
          mode,
        };

        void saveProviderSetup(setupParams)
          .then(() => {
            onComplete(setupParams);
          })
          .catch((err) => {
            setErrorMsg(String(err));
            setStep("model");
          });
      }
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
          CoreBlow v2.1.0 · First-Run Setup Wizard
        </Text>
        <Text color={inkPalette.dim}>
          Step: {step === "mode_theme" ? "1/3" : step === "provider" || step === "credentials" ? "2/3" : "3/3"}
        </Text>
      </Box>

      {errorMsg && (
        <Box marginY={1}>
          <Text color={inkPalette.error}>{errorMsg}</Text>
        </Box>
      )}

      {step === "mode_theme" && (
        <Box flexDirection="column" marginY={1}>
          <Text bold color={inkPalette.text}>
            1. Workspace Mode & Theme
          </Text>
          <Box marginY={1} flexDirection="column">
            <Text color={inkPalette.dim}>
              Mode [◀ <Text bold color={inkPalette.accent}>{mode.toUpperCase()}</Text> ▶]: {mode === "pro" ? "Full developer telemetry & shortcuts" : "Minimal, focused UI"}
            </Text>
            <Text color={inkPalette.dim}>
              Theme [▲▼ <Text bold color={inkPalette.accentSoft}>{theme.toUpperCase()}</Text>]: Terminal color palette
            </Text>
          </Box>
          <Text color={inkPalette.dim}>Use ◀▶ and ▲▼ to toggle, then press Enter to continue.</Text>
        </Box>
      )}

      {step === "provider" && (
        <Box flexDirection="column" marginY={1}>
          <Text bold color={inkPalette.text}>
            2. Choose Your Primary LLM Provider
          </Text>
          <Box flexDirection="column" marginY={1}>
            {PROVIDERS.map((p, idx) => {
              const isSelected = idx === providerIndex;
              return (
                <Box key={p.id}>
                  <Text color={isSelected ? inkPalette.accent : inkPalette.dim}>
                    {isSelected ? "❯ " : "  "}
                  </Text>
                  <Text bold={isSelected} color={isSelected ? inkPalette.text : inkPalette.dim}>
                    {p.label}
                  </Text>
                </Box>
              );
            })}
          </Box>
          <Text color={inkPalette.dim}>Use ▲▼ to select provider, then press Enter.</Text>
        </Box>
      )}

      {step === "credentials" && (
        <Box flexDirection="column" marginY={1}>
          <Text bold color={inkPalette.text}>
            Enter API Key for {selectedProvider.label}
          </Text>
          <Box marginY={1}>
            <Text color={inkPalette.dim}>{selectedProvider.envVar}: </Text>
            <Text color={inkPalette.accent}>
              {apiKey ? "•".repeat(apiKey.length) : selectedProvider.placeholder}
            </Text>
          </Box>
          <Text color={inkPalette.dim}>Keys are stored securely with 0600 permissions in ~/.coreblow/.env.</Text>
          <Text color={inkPalette.dim}>Type your key, then press Enter.</Text>
        </Box>
      )}

      {step === "model" && (
        <Box flexDirection="column" marginY={1}>
          <Text bold color={inkPalette.text}>
            3. Select Default Model for {selectedProvider.label}
          </Text>
          <Box flexDirection="column" marginY={1}>
            {availableModels.map((m, idx) => {
              const isSelected = idx === modelIndex;
              return (
                <Box key={m}>
                  <Text color={isSelected ? inkPalette.accent : inkPalette.dim}>
                    {isSelected ? "❯ " : "  "}
                  </Text>
                  <Text bold={isSelected} color={isSelected ? inkPalette.text : inkPalette.dim}>
                    {m}
                  </Text>
                </Box>
              );
            })}
          </Box>
          <Text color={inkPalette.dim}>Use ▲▼ to select model, then press Enter to finish setup.</Text>
        </Box>
      )}

      {step === "saving" && (
        <Box marginY={1}>
          <Text bold color={inkPalette.accent}>
            Saving configuration and starting CoreBlow...
          </Text>
        </Box>
      )}
    </Box>
  );
};
