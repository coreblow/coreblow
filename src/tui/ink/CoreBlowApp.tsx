import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Box, Text, useInput, useApp } from "ink";
import process from "node:process";
import { execSync } from "node:child_process";
import { ModelPickerModal } from "./ModelPickerModal.js";
import { FirstRunWizard } from "./FirstRunWizard.js";
import { RewindModal, type RewindMode } from "./RewindModal.js";
import { DiffView } from "./DiffView.js";
import { ApprovalModal, type ApprovalDecision } from "./ApprovalModal.js";
import { SessionPickerModal } from "./SessionPickerModal.js";
import { StatusBar } from "./StatusBar.js";
import { ToolRow, TurnSummaryRule, type ToolCallItem } from "./ToolRow.js";
import {
  cleanupStaleProviderConfig,
  normalizeModelId,
  splitModelRef,
  type ReasoningEffort,
} from "./model-picker-utils.js";
import {
  cyclePermissionMode,
  getPermissionModeBadge,
  collapsePastedText,
  expandPastedChips,
  filterSlashCommands,
  parseShellEscape,
  isDangerousShellCommand,
  executeLocalShell,
  DraftStashStack,
  type PermissionMode,
} from "./input-prefixes.js";
import { expandContextReferences } from "./context-expander.js";
import {
  calculateContextMetrics,
  compactHistory,
  getContextBreakdown,
} from "./context-telemetry.js";
import {
  recordTerminalSessionBreadcrumb,
  resolveSessionByIdOrQuery,
} from "../../cli/session-resume.js";
import {
  getSqliteSession,
  isSqliteAvailable,
} from "../../sessions/sqlite-session-store.js";
import { getUnifiedSession } from "../../sessions/unified-session-store.js";
import { inkPalette } from "./theme.js";
import type { TuiBackend, TuiModelChoice } from "../tui-backend.js";
import type { TuiOptions } from "../tui-types.js";
import { loadConfig } from "../../config/config.js";
import { writeConfigFile } from "../../config/config-io.js";
import { resolveAgentModelPrimaryValue } from "../../config/model-input.js";
import { getCheckpointManager } from "../../security/checkpoint-manager.js";

export interface MessageItem {
  id: string;
  role: "user" | "assistant" | "system" | "tool" | "error";
  text: string;
  toolCall?: ToolCallItem;
}

export interface CoreBlowAppProps {
  backend: TuiBackend;
  opts: TuiOptions;
  needsSetup?: boolean;
}

type ActiveModal =
  | "none"
  | "model"
  | "setup"
  | "help"
  | "diff"
  | "rewind"
  | "approval"
  | "sessions";

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

  const initialModalState: ActiveModal =
    opts.initialModal && opts.initialModal !== "none"
      ? (opts.initialModal as ActiveModal)
      : needsSetup
        ? "setup"
        : "none";

  const [modal, setModal] = useState<ActiveModal>(initialModalState);
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: "init",
      role: "system",
      text: "CoreBlow v2.0.0 ready · Type / for commands, @ for context, ! for local shell, Ctrl+P for sessions.",
    },
  ]);
  const [inputVal, setInputVal] = useState("");
  const [cursorPos, setCursorPos] = useState(0);
  const [activeModel, setActiveModel] = useState<string>(
    resolveAgentModelPrimaryValue(cfg.agents?.defaults?.model) || "coreblow/native",
  );
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>("off");
  const [permissionMode, setPermissionMode] = useState<PermissionMode>("manual");
  const [isBusy, setIsBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [lastCtrlCAt, setLastCtrlCAt] = useState(0);
  const [lastEscAt, setLastEscAt] = useState(0);
  const [modelsList, setModelsList] = useState<TuiModelChoice[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [diffString, setDiffString] = useState("");
  const [pendingApproval, setPendingApproval] = useState<{
    tool: string;
    target: string;
    description?: string;
  } | null>(null);

  // Stashed drafts and pasted chips
  const draftStackRef = useRef(new DraftStashStack());
  const pastedChipsRef = useRef(new Map<string, string>());
  const sessionKeyRef = useRef(opts.session || "agent:main:main");
  const [draftCount, setDraftCount] = useState(0);

  // Determine backend badge
  const backendBadge = backend.connection.url.includes("embedded")
    ? "Local"
    : backend.connection.url.includes("18789")
      ? "Gateway :18789"
      : "Remote Node";

  // Resume / Load previous conversation recap
  const resumeSessionRecord = useCallback((sessionId: string) => {
    sessionKeyRef.current = sessionId;
    recordTerminalSessionBreadcrumb({ sessionId, cwd: process.cwd() });
    try {
      const rec = isSqliteAvailable()
        ? getSqliteSession(sessionId)
        : getUnifiedSession(sessionId);
      if (rec && Array.isArray(rec.messages) && rec.messages.length > 0) {
        const lastExchanges = rec.messages.slice(-6);
        const recapTitle = rec.title || rec.id;
        const recapMessages: MessageItem[] = [
          {
            id: `recap_header_${Date.now()}`,
            role: "system",
            text: `── Previous Conversation Recap (${recapTitle}) ──`,
          },
          ...lastExchanges.map((m) => ({
            id: m.id || String(Date.now() + Math.random()),
            role: (m.role === "assistant" ? "assistant" : "user") as any,
            text: m.content,
          })),
          {
            id: `recap_footer_${Date.now()}`,
            role: "system",
            text: `Resumed session ${recapTitle}. Enter a prompt to continue.`,
          },
        ];
        setMessages(recapMessages);
        if (rec.model) {
          setActiveModel(rec.model);
        }
      }
    } catch {
      // Best-effort
    }
  }, []);

  // Initial resume on startup if opts.session is passed
  useEffect(() => {
    if (opts.session && opts.session !== "agent:main:main") {
      resumeSessionRecord(opts.session);
    }
  }, [opts.session, resumeSessionRecord]);

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
          const toolCallItem: ToolCallItem = {
            id: String(Date.now()),
            name: toolName,
            target: payload.data?.input?.path || payload.data?.input?.command || "",
            status: "running",
            durationMs: 100,
            outputPreview: payload.data?.output ? String(payload.data.output) : undefined,
          };
          setMessages((prev) => [
            ...prev,
            { id: String(Date.now()), role: "tool", text: `› ${toolName}`, toolCall: toolCallItem },
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
        case "/rewind":
          setModal("rewind");
          break;
        case "/diff": {
          try {
            const out = execSync("git diff", { encoding: "utf8", timeout: 5000 });
            setDiffString(out || "");
            setModal("diff");
          } catch (err) {
            setMessages((prev) => [
              ...prev,
              { id: String(Date.now()), role: "error", text: `Failed to inspect git diff: ${String(err)}` },
            ]);
          }
          break;
        }
        case "/context": {
          const breakdown = getContextBreakdown(messages);
          const lines = [
            `── CoreBlow Context Breakdown (${breakdown.totalTokens} tokens) ──`,
            `  • System Prompt: ${breakdown.systemPromptTokens} tokens`,
            `  • Project Rules & Memory: ${breakdown.rulesAndMemoryTokens} tokens`,
            `  • Skills Definitions: ${breakdown.skillsTokens} tokens`,
            `  • Conversation History: ${breakdown.conversationTokens} tokens`,
            `  • Tool Outputs: ${breakdown.toolOutputsTokens} tokens`,
            `  • Window Usage: ${breakdown.bar} ${breakdown.percentage}% of ${breakdown.maxTokens} limit`,
          ];
          setMessages((prev) => [
            ...prev,
            { id: String(Date.now()), role: "system", text: lines.join("\n") },
          ]);
          break;
        }
        case "/compact": {
          const focus = args.join(" ");
          const res = compactHistory(messages, { focus });
          if (res.compressed) {
            setMessages([
              ...res.messages,
              {
                id: String(Date.now()),
                role: "system",
                text: `History compacted successfully (saved ~${res.savedTokens} tokens). Preserved project rules (AGENTS.md/SOUL.md) and active memory.`,
              },
            ]);
          } else {
            setMessages((prev) => [
              ...prev,
              {
                id: String(Date.now()),
                role: "system",
                text: "History already within safe token limits; no compaction needed.",
              },
            ]);
          }
          break;
        }
        case "/usage":
        case "/cost": {
          const estimatedTokens = messages.reduce((acc, m) => acc + Math.ceil(m.text.length / 3.8), 0);
          const metrics = calculateContextMetrics({
            usedTokens: estimatedTokens,
            provider: splitModelRef(activeModel).provider,
          });
          const lines = [
            `── Session Usage & Estimated Cost ──`,
            `  • Total Tokens: ${metrics.formattedUsed} (${metrics.usedTokens} tokens)`,
            `  • Estimated Cost: $${metrics.costUsd.toFixed(4)} USD`,
            `  • Active Context Window: ${metrics.formattedMax} (${metrics.percentage}% used)`,
          ];
          setMessages((prev) => [
            ...prev,
            { id: String(Date.now()), role: "system", text: lines.join("\n") },
          ]);
          break;
        }
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
        case "/sessions":
        case "/resume": {
          if (args.length > 0) {
            const q = args.join(" ");
            const found = resolveSessionByIdOrQuery(q);
            if (found) {
              resumeSessionRecord(found.id);
              break;
            }
            setMessages((prev) => [
              ...prev,
              { id: String(Date.now()), role: "error", text: `Session not found matching "${q}"` },
            ]);
            break;
          }
          setModal("sessions");
          break;
        }
        default:
          setMessages((prev) => [
            ...prev,
            { id: String(Date.now()), role: "system", text: `Unknown slash command: ${command}. Type /help.` },
          ]);
      }
    },
    [backend, exit, messages, activeModel, resumeSessionRecord],
  );

  const handleSubmit = useCallback(async () => {
    let rawText = inputVal.trim();
    if (!rawText) return;

    // Expand any paste chips back to original full content
    if (pastedChipsRef.current.size > 0) {
      rawText = expandPastedChips(rawText, pastedChipsRef.current);
      pastedChipsRef.current.clear();
    }

    setInputVal("");
    setCursorPos(0);

    // 1. Slash command
    if (rawText.startsWith("/")) {
      await handleSlashCommand(rawText);
      return;
    }

    // 2. Local shell escape (!command)
    const shellParsed = parseShellEscape(rawText);
    if (shellParsed.isShell) {
      const danger = isDangerousShellCommand(shellParsed.command);
      if (danger.dangerous) {
        setMessages((prev) => [
          ...prev,
          { id: String(Date.now()), role: "user", text: `!${shellParsed.command}` },
          { id: String(Date.now() + 1), role: "error", text: danger.reason || "Dangerous shell command blocked." },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        { id: String(Date.now()), role: "user", text: `!${shellParsed.command}` },
      ]);

      const execResult = await executeLocalShell(shellParsed.command);
      const out = (execResult.stdout + (execResult.stderr ? `\n${execResult.stderr}` : "")).trim();
      const statusIcon = execResult.exitCode === 0 ? "✓" : `✗ [${execResult.exitCode}]`;

      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          role: "tool",
          text: `! ${shellParsed.command} ${statusIcon}\n${out || "(no output)"}`,
        },
      ]);
      return;
    }

    // 3. Context references (@file, @diff, etc.)
    const contextRes = expandContextReferences(rawText);
    if (contextRes.refused) {
      setMessages((prev) => [
        ...prev,
        { id: String(Date.now()), role: "error", text: contextRes.refused! },
      ]);
      return;
    }

    if (contextRes.warnings.length > 0) {
      for (const w of contextRes.warnings) {
        setMessages((prev) => [
          ...prev,
          { id: String(Date.now()), role: "system", text: w },
        ]);
      }
    }

    const textToSend = contextRes.expanded;

    setMessages((prev) => [
      ...prev,
      { id: String(Date.now()), role: "user", text: rawText },
    ]);

    setIsBusy(true);
    setStatusMsg("Thinking...");

    try {
      const res = await backend.sendChat({
        sessionKey: sessionKeyRef.current,
        message: textToSend,
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

    // Shift+Tab: cycle permission mode
    if (key.tab && (key.shift || input === "\x1b[Z")) {
      setPermissionMode((prev) => cyclePermissionMode(prev));
      return;
    }

    // Ctrl+P: Sessions modal
    if (key.ctrl && input === "p") {
      setModal("sessions");
      return;
    }

    // Ctrl+S: Draft stash stack
    if (key.ctrl && input === "s") {
      if (inputVal.trim().length > 0) {
        const count = draftStackRef.current.push(inputVal);
        setInputVal("");
        setCursorPos(0);
        setDraftCount(count);
        setStatusMsg(`Draft stashed (📌 ${count}).`);
      } else {
        const popped = draftStackRef.current.pop();
        if (popped) {
          setInputVal(popped);
          setCursorPos(popped.length);
          setDraftCount(draftStackRef.current.count());
          setStatusMsg("Draft restored from stash.");
        }
      }
      return;
    }

    // Ctrl+O: Toggle tool output expand/collapse
    if (key.ctrl && input === "o") {
      setToolsExpanded((prev) => !prev);
      return;
    }

    // Ctrl+C: Safe exit behavior
    if (key.ctrl && input === "c") {
      const now = Date.now();
      if (inputVal.length > 0) {
        setInputVal("");
        setCursorPos(0);
        setStatusMsg("Cleared input. Press Ctrl+C again to exit.");
        setLastCtrlCAt(now);
        return;
      }
      if (lastCtrlCAt > 0 && now - lastCtrlCAt <= 1500) {
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

    // Esc & Double-Esc rewind
    if (key.escape) {
      const now = Date.now();
      if (inputVal.length === 0) {
        if (lastEscAt > 0 && now - lastEscAt <= 800) {
          setModal("rewind");
          setLastEscAt(0);
          return;
        }
        setLastEscAt(now);
      }
      if (isBusy) {
        abortActiveTurn();
      }
      return;
    }

    // Multi-line / newline shortcuts: Ctrl+J or \ + Enter
    if (key.ctrl && input === "j") {
      setInputVal((prev) => prev.slice(0, cursorPos) + "\n" + prev.slice(cursorPos));
      setCursorPos((prev) => prev + 1);
      return;
    }

    if (key.return) {
      if (inputVal.endsWith("\\")) {
        setInputVal((prev) => prev.slice(0, -1) + "\n");
        setCursorPos((prev) => prev);
        return;
      }
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

    // Detect large paste burst
    if (input && !key.ctrl && !key.meta) {
      const collapsed = collapsePastedText(input, pastedChipsRef.current.size);
      if (collapsed.isChip && collapsed.chipLabel) {
        pastedChipsRef.current.set(collapsed.chipLabel, collapsed.fullContent);
        setInputVal((prev) => prev.slice(0, cursorPos) + collapsed.displayText + prev.slice(cursorPos));
        setCursorPos((prev) => prev + collapsed.displayText.length);
        return;
      }

      setInputVal((prev) => prev.slice(0, cursorPos) + input + prev.slice(cursorPos));
      setCursorPos((prev) => prev + input.length);
    }
  });

  // Autocomplete matching
  const slashMatches = inputVal.startsWith("/")
    ? filterSlashCommands(inputVal)
    : [];

  const estimatedTokens = useMemo(() => {
    return messages.reduce((acc, m) => acc + Math.ceil(m.text.length / 3.8), 0);
  }, [messages]);

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
        <Box>
          {draftCount > 0 && (
            <Text color={inkPalette.accentSoft}>📌 {draftCount} · </Text>
          )}
          <Text bold color={backendBadge === "Local" ? inkPalette.accentSoft : inkPalette.success}>
            [{backendBadge}]
          </Text>
        </Box>
      </Box>

      {/* 2. TranscriptView */}
      <Box flexDirection="column" marginY={1}>
        {messages.slice(-12).map((msg) => {
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
            if (msg.toolCall) {
              return (
                <ToolRow key={msg.id} tool={msg.toolCall} expanded={toolsExpanded} />
              );
            }
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

      {/* 3. ModalSlot (exclusive overlay - HIDES StatusBar) */}
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

      {modal === "diff" && (
        <Box marginY={1}>
          <DiffView
            diff={diffString}
            onClose={() => setModal("none")}
          />
        </Box>
      )}

      {modal === "rewind" && (
        <Box marginY={1}>
          <RewindModal
            sessionId={sessionKeyRef.current}
            onRollback={(cpId, rollbackMode: RewindMode) => {
              try {
                const res = getCheckpointManager().rollbackCheckpoint(cpId, sessionKeyRef.current);
                setModal("none");
                setMessages((prev) => [
                  ...prev,
                  { id: String(Date.now()), role: "system", text: `${res.message} (mode: ${rollbackMode})` },
                ]);
              } catch (err) {
                setModal("none");
                setMessages((prev) => [
                  ...prev,
                  { id: String(Date.now()), role: "error", text: `Rewind failed: ${String(err)}` },
                ]);
              }
            }}
            onClose={() => setModal("none")}
          />
        </Box>
      )}

      {modal === "sessions" && (
        <Box marginY={1}>
          <SessionPickerModal
            onSelect={(selectedId) => {
              setModal("none");
              resumeSessionRecord(selectedId);
            }}
            onClose={() => setModal("none")}
          />
        </Box>
      )}

      {modal === "approval" && pendingApproval && (
        <Box marginY={1}>
          <ApprovalModal
            tool={pendingApproval.tool}
            commandOrPath={pendingApproval.target}
            description={pendingApproval.description}
            onDecision={(decision: ApprovalDecision, comment?: string) => {
              setModal("none");
              setPendingApproval(null);
              setMessages((prev) => [
                ...prev,
                {
                  id: String(Date.now()),
                  role: "system",
                  text: `Approval ${decision}${comment ? ` with steering: "${comment}"` : ""}.`,
                },
              ]);
            }}
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
            {filterSlashCommands("").map((c) => (
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
          </Box>

          {/* Autocomplete suggestions preview */}
          {slashMatches.length > 0 && inputVal.length > 1 && (
            <Box flexDirection="column" borderStyle="single" borderColor={inkPalette.border} paddingX={1} marginY={0}>
              {slashMatches.slice(0, 5).map((m, idx) => (
                <Box key={m.cmd} justifyContent="space-between">
                  <Text color={idx === 0 ? inkPalette.accent : inkPalette.dim}>
                    {idx === 0 ? "❯ " : "  "}
                    {m.cmd}
                  </Text>
                  <Text color={inkPalette.dim}>{m.desc}</Text>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* 5. Responsive 3-Tier StatusBar (HIDDEN when ModalSlot is active to prevent collision) */}
      {modal === "none" && (
        <StatusBar
          model={activeModel}
          provider={splitModelRef(activeModel).provider}
          permissionMode={permissionMode}
          backendBadge={backendBadge}
          usedTokens={estimatedTokens}
          isBusy={isBusy}
          statusMsg={statusMsg}
        />
      )}
    </Box>
  );
};
