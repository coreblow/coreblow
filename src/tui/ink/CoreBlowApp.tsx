import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Text, useInput, useApp } from "ink";
import process from "node:process";
import { ModelPickerModal } from "./ModelPickerModal.js";
import { FirstRunWizard } from "./FirstRunWizard.js";
import {
  cleanupStaleProviderConfig,
  normalizeModelId,
  splitModelRef,
  type ReasoningEffort,
} from "./model-picker-utils.js";
import { inkPalette } from "./theme.js";
import type { TuiBackend, TuiModelChoice } from "../tui-backend.js";
import type { TuiOptions } from "../tui-types.js";
import { loadConfig } from "../../config/config.js";
import { writeConfigFile } from "../../config/config-io.js";
import { resolveAgentModelPrimaryValue } from "../../config/model-input.js";

export interface MessageItem {
  id: string;
  role: "user" | "assistant" | "system" | "tool" | "error";
  text: string;
  toolName?: string;
}

export interface CoreBlowAppProps {
  backend: TuiBackend;
  opts: TuiOptions;
  needsSetup?: boolean;
}

type ActiveModal = "none" | "model" | "setup" | "help";

const SLASH_COMMANDS = [
  { cmd: "/help", desc: "Show slash commands" },
  { cmd: "/model", desc: "Open model switcher" },
  { cmd: "/setup", desc: "Run setup wizard" },
  { cmd: "/clear", desc: "Clear current session" },
  { cmd: "/rollback", desc: "Rollback file edit checkpoint" },
  { cmd: "/desktop", desc: "Launch CoreBlow Studio desktop" },
  { cmd: "/sessions", desc: "List recent sessions" },
  { cmd: "/exit", desc: "Exit CoreBlow TUI" },
];

function shortenCwd(cwd: string = process.cwd()): string {
  const home = process.env.HOME || "";
  if (home && cwd.startsWith(home)) {
    return `~${cwd.slice(home.length)}`;
  }
  return cwd;
}

export const CoreBlowApp: React.FC<CoreBlowAppProps> = ({
  backend,
  opts,
  needsSetup = false,
}) => {
  const { exit } = useApp();
  const cfg = loadConfig();

  const [modal, setModal] = useState<ActiveModal>(needsSetup ? "setup" : "none");
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: "init",
      role: "system",
      text: "CoreBlow v2.0.0 ready · Type /help for slash commands, Ctrl+L for models, Ctrl+C to exit.",
    },
  ]);
  const [inputVal, setInputVal] = useState("");
  const [cursorPos, setCursorPos] = useState(0);
  const [activeModel, setActiveModel] = useState<string>(
    resolveAgentModelPrimaryValue(cfg.agents?.defaults?.model) || "coreblow/native",
  );
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>("off");
  const [isBusy, setIsBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [lastCtrlCAt, setLastCtrlCAt] = useState(0);
  const [modelsList, setModelsList] = useState<TuiModelChoice[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const sessionKeyRef = useRef(opts.session || "agent:main:main");

  // Determine backend badge
  const backendBadge = backend.connection.url.includes("embedded")
    ? "Local"
    : backend.connection.url.includes("18789")
      ? "Gateway :18789"
      : "Remote Node";

  // Load models from backend
  useEffect(() => {
    void backend.listModels().then((res) => {
      if (Array.isArray(res) && res.length > 0) {
        setModelsList(res);
      }
    });
  }, [backend]);

  // Subscribe to backend events
  useEffect(() => {
    backend.onEvent = (evt) => {
      if (evt.event === "chat") {
        const payload = evt.payload as any;
        if (payload?.state === "delta") {
          const deltaText = payload.deltaText || payload.message?.content?.[0]?.text;
          if (deltaText) {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === "assistant" && last.id === payload.runId) {
                const nextText = payload.replace ? deltaText : last.text + deltaText;
                return [...prev.slice(0, -1), { ...last, text: nextText }];
              }
              return [
                ...prev,
                { id: payload.runId || String(Date.now()), role: "assistant", text: deltaText },
              ];
            });
          }
        } else if (payload?.state === "final") {
          setIsBusy(false);
          setActiveRunId(null);
        } else if (payload?.state === "error") {
          setIsBusy(false);
          setActiveRunId(null);
          setMessages((prev) => [
            ...prev,
            { id: String(Date.now()), role: "error", text: payload.errorMessage || "Unknown error" },
          ]);
        }
      } else if (evt.event === "agent") {
        const payload = evt.payload as any;
        if (payload?.stream === "tool") {
          const toolName = payload.data?.name || "tool";
          setMessages((prev) => [
            ...prev,
            { id: String(Date.now()), role: "tool", text: `› ${toolName}`, toolName },
          ]);
        }
      }
    };
  }, [backend]);

  const abortActiveTurn = useCallback(() => {
    if (activeRunId) {
      void backend.abortChat({ sessionKey: sessionKeyRef.current, runId: activeRunId });
      setActiveRunId(null);
      setIsBusy(false);
      setMessages((prev) => [
        ...prev,
        { id: String(Date.now()), role: "system", text: "Turn aborted." },
      ]);
    }
  }, [backend, activeRunId]);

  const handleSlashCommand = useCallback(
    async (cmdText: string) => {
      const [cmd, ...args] = cmdText.trim().split(/\s+/);
      const command = cmd?.toLowerCase();

      switch (command) {
        case "/exit":
        case "/quit":
          exit();
          break;
        case "/help":
          setModal("help");
          break;
        case "/model":
        case "/models":
          setModal("model");
          break;
        case "/setup":
          setModal("setup");
          break;
        case "/clear": {
          setMessages([
            {
              id: String(Date.now()),
              role: "system",
              text: "Session cleared. Started fresh turn.",
            },
          ]);
          try {
            await backend.resetSession(sessionKeyRef.current, "reset");
          } catch {}
          break;
        }
        case "/rollback": {
          try {
            const { getCheckpointManager } = await import("../../security/checkpoint-manager.js");
            const res = getCheckpointManager().rollbackCheckpoint(
              args[0],
              sessionKeyRef.current,
            );
            setMessages((prev) => [
              ...prev,
              { id: String(Date.now()), role: "system", text: res.message },
            ]);
          } catch (err) {
            setMessages((prev) => [
              ...prev,
              { id: String(Date.now()), role: "error", text: `Rollback failed: ${String(err)}` },
            ]);
          }
          break;
        }
        case "/desktop": {
          try {
            const { launchDesktopApp } = await import("../../cli/desktop-cli.js");
            const res = launchDesktopApp();
            setMessages((prev) => [
              ...prev,
              {
                id: String(Date.now()),
                role: "system",
                text: res.launched
                  ? `CoreBlow Studio launched (${res.strategy}).`
                  : "Could not launch desktop app.",
              },
            ]);
          } catch (err) {
            setMessages((prev) => [
              ...prev,
              { id: String(Date.now()), role: "error", text: `Desktop launch failed: ${String(err)}` },
            ]);
          }
          break;
        }
        case "/sessions": {
          try {
            const list = await backend.listSessions();
            const sessionRows = (list.sessions || []).slice(0, 8);
            if (sessionRows.length === 0) {
              setMessages((prev) => [
                ...prev,
                { id: String(Date.now()), role: "system", text: "No previous sessions found." },
              ]);
            } else {
              const lines = ["Recent Sessions:"];
              for (const s of sessionRows) {
                const title = s.derivedTitle || s.label || "(untitled)";
                lines.push(`  • ${s.key} - ${title}`);
              }
              setMessages((prev) => [
                ...prev,
                { id: String(Date.now()), role: "system", text: lines.join("\n") },
              ]);
            }
          } catch (err) {
            setMessages((prev) => [
              ...prev,
              { id: String(Date.now()), role: "error", text: `List sessions failed: ${String(err)}` },
            ]);
          }
          break;
        }
        default:
          setMessages((prev) => [
            ...prev,
            { id: String(Date.now()), role: "system", text: `Unknown slash command: ${command}. Type /help.` },
          ]);
      }
    },
    [backend, exit],
  );

  const handleSubmit = useCallback(async () => {
    const text = inputVal.trim();
    if (!text) return;

    setInputVal("");
    setCursorPos(0);

    if (text.startsWith("/")) {
      await handleSlashCommand(text);
      return;
    }

    setMessages((prev) => [
      ...prev,
      { id: String(Date.now()), role: "user", text },
    ]);

    setIsBusy(true);
    setStatusMsg("Thinking...");

    try {
      const res = await backend.sendChat({
        sessionKey: sessionKeyRef.current,
        message: text,
        thinking: reasoningEffort !== "off" ? reasoningEffort : undefined,
        deliver: opts.deliver,
      });
      setActiveRunId(res.runId);
    } catch (err) {
      setIsBusy(false);
      setMessages((prev) => [
        ...prev,
        { id: String(Date.now()), role: "error", text: `Send failed: ${String(err)}` },
      ]);
    }
  }, [inputVal, backend, opts.deliver, reasoningEffort, handleSlashCommand]);

  // Main input handler when no modal is active
  useInput((input, key) => {
    if (modal !== "none") {
      return;
    }

    if (key.ctrl && input === "c") {
      const now = Date.now();
      if (inputVal.length > 0) {
        setInputVal("");
        setCursorPos(0);
        setStatusMsg("Cleared input. Press Ctrl+C again to exit.");
        setLastCtrlCAt(now);
        return;
      }
      if (now - lastCtrlCAt <= 1500) {
        exit();
        return;
      }
      setStatusMsg("Press Ctrl+C again to exit.");
      setLastCtrlCAt(now);
      return;
    }

    if (key.ctrl && input === "d") {
      exit();
      return;
    }

    if (key.ctrl && input === "l") {
      setModal("model");
      return;
    }

    if (key.escape) {
      if (isBusy) {
        abortActiveTurn();
      }
      return;
    }

    if (key.return) {
      void handleSubmit();
      return;
    }

    if (key.backspace || key.delete) {
      if (cursorPos > 0) {
        setInputVal((prev) => prev.slice(0, cursorPos - 1) + prev.slice(cursorPos));
        setCursorPos((prev) => Math.max(0, prev - 1));
      }
      return;
    }

    if (key.leftArrow) {
      setCursorPos((prev) => Math.max(0, prev - 1));
      return;
    }

    if (key.rightArrow) {
      setCursorPos((prev) => Math.min(inputVal.length, prev + 1));
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      setInputVal((prev) => prev.slice(0, cursorPos) + input + prev.slice(cursorPos));
      setCursorPos((prev) => prev + input.length);
    }
  });

  // Autocomplete hints
  const matchingCommand = inputVal.startsWith("/")
    ? SLASH_COMMANDS.find((c) => c.cmd.startsWith(inputVal.toLowerCase()) && c.cmd !== inputVal)
    : null;

  return (
    <Box flexDirection="column" paddingX={1} paddingY={0}>
      {/* 1. HeaderBar */}
      <Box justifyContent="space-between" borderStyle="single" borderBottom borderColor={inkPalette.border}>
        <Box>
          <Text bold color={inkPalette.accent}>
            CoreBlow v2.0.0
          </Text>
          <Text color={inkPalette.dim}> · {shortenCwd()}</Text>
        </Box>
        <Text bold color={backendBadge === "Local" ? inkPalette.accentSoft : inkPalette.success}>
          [{backendBadge}]
        </Text>
      </Box>

      {/* 2. TranscriptView */}
      <Box flexDirection="column" marginY={1}>
        {messages.slice(-14).map((msg) => {
          if (msg.role === "user") {
            return (
              <Box key={msg.id} marginY={0}>
                <Text bold color={inkPalette.accent}>
                  coreblow ❯{" "}
                </Text>
                <Text color={inkPalette.text}>{msg.text}</Text>
              </Box>
            );
          }
          if (msg.role === "assistant") {
            return (
              <Box key={msg.id} marginY={0}>
                <Text color={inkPalette.text}>{msg.text}</Text>
              </Box>
            );
          }
          if (msg.role === "tool") {
            return (
              <Box key={msg.id} marginY={0}>
                <Text color={inkPalette.dim}>{msg.text}</Text>
              </Box>
            );
          }
          if (msg.role === "error") {
            return (
              <Box key={msg.id} marginY={0}>
                <Text bold color={inkPalette.error}>
                  Error: {msg.text}
                </Text>
              </Box>
            );
          }
          return (
            <Box key={msg.id} marginY={0}>
              <Text color={inkPalette.dim}>{msg.text}</Text>
            </Box>
          );
        })}
      </Box>

      {/* 3. ModalSlot (exclusive overlay) */}
      {modal === "model" && (
        <Box marginY={1}>
          <ModelPickerModal
            models={modelsList}
            currentModel={activeModel}
            currentEffort={reasoningEffort}
            onSelect={(newModel, effort, saveDefault) => {
              const prevProvider = splitModelRef(activeModel).provider;
              const nextProvider = splitModelRef(newModel).provider;
              const normalized = normalizeModelId(nextProvider, newModel);

              setActiveModel(normalized);
              setReasoningEffort(effort);
              setModal("none");

              setMessages((prev) => [
                ...prev,
                {
                  id: String(Date.now()),
                  role: "system",
                  text: `Model switched to ${normalized} (effort: ${effort})${saveDefault ? " [saved default]" : ""}.`,
                },
              ]);

              if (saveDefault) {
                const updatedCfg = cleanupStaleProviderConfig(prevProvider, nextProvider, loadConfig());
                if (!updatedCfg.agents) updatedCfg.agents = {};
                if (!updatedCfg.agents.defaults) updatedCfg.agents.defaults = {};
                updatedCfg.agents.defaults.model = { primary: normalized };
                void writeConfigFile(updatedCfg);
              }
            }}
            onClose={() => setModal("none")}
          />
        </Box>
      )}

      {modal === "setup" && (
        <Box marginY={1}>
          <FirstRunWizard
            onComplete={(setup) => {
              if (setup.model) {
                setActiveModel(setup.model);
              }
              setModal("none");
              setMessages((prev) => [
                ...prev,
                {
                  id: String(Date.now()),
                  role: "system",
                  text: `Setup complete! Configured ${setup.provider} with default model ${setup.model || "coreblow/native"}.`,
                },
              ]);
            }}
            onCancel={() => setModal("none")}
          />
        </Box>
      )}

      {modal === "help" && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={inkPalette.accent}
          paddingX={2}
          paddingY={1}
          marginY={1}
          width={68}
        >
          <Text bold color={inkPalette.accent}>
            CoreBlow Slash Commands
          </Text>
          <Box flexDirection="column" marginY={1}>
            {SLASH_COMMANDS.map((c) => (
              <Box key={c.cmd} justifyContent="space-between">
                <Text bold color={inkPalette.text}>
                  {c.cmd}
                </Text>
                <Text color={inkPalette.dim}>{c.desc}</Text>
              </Box>
            ))}
          </Box>
          <Text color={inkPalette.dim}>Press Esc to close this menu.</Text>
        </Box>
      )}

      {/* 4. ComposerBox (prompt input) */}
      {modal === "none" && (
        <Box flexDirection="column" marginY={1}>
          <Box>
            <Text bold color={inkPalette.accent}>
              coreblow ❯{" "}
            </Text>
            <Text color={inkPalette.text}>{inputVal}</Text>
            {matchingCommand && (
              <Text color={inkPalette.dim}>
                {"  "}(hint: {matchingCommand.cmd} - {matchingCommand.desc})
              </Text>
            )}
          </Box>
        </Box>
      )}

      {/* 5. StatusBar (HIDDEN when ModalSlot is active to prevent collision) */}
      {modal === "none" && (
        <Box borderStyle="single" borderTop borderColor={inkPalette.border} justifyContent="space-between">
          <Box>
            <Text color={inkPalette.dim}>model: </Text>
            <Text bold color={inkPalette.text}>
              {activeModel}
            </Text>
            {reasoningEffort !== "off" && (
              <Text color={inkPalette.accentSoft}> [{reasoningEffort}]</Text>
            )}
            {isBusy && <Text color={inkPalette.accent}> · {statusMsg || "busy"}</Text>}
          </Box>
          <Text color={inkPalette.dim}>
            /help · Ctrl+L models · Ctrl+C exit
          </Text>
        </Box>
      )}
    </Box>
  );
};
