import React, { useRef, useEffect, useState } from "react";
import type { ModelTier, PermissionMode } from "../types/gateway";
import { gatewayClient } from "../services/gateway-client";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FolderIcon,
  MicIcon,
  PlusIcon,
  SendIcon,
  ShieldIcon,
  SparklesIcon,
  StopIcon,
  UsersIcon,
} from "./Icons";

export interface ComposerProps {
  prompt: string;
  onChangePrompt: (val: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  permissionMode: PermissionMode;
  onChangePermissionMode: (mode: PermissionMode) => void;
  modelTier: ModelTier;
  onChangeModelTier: (tier: ModelTier) => void;
  activeModel?: string;
  onChangeActiveModel?: (model: string) => void;
  agentTeamwork?: boolean;
  onToggleAgentTeamwork?: (enabled: boolean) => void;
  executionMode?: "standard" | "autonomous" | "warroom";
  onChangeExecutionMode?: (mode: "standard" | "autonomous" | "warroom") => void;
  attachedFiles: string[];
  onAddFiles: (paths: string[]) => void;
  onRemoveFile: (path: string) => void;
  projectName: string;
  projectBranch: string;
  onSelectWorkspace?: () => void;
  autoSpeak?: boolean;
  onToggleAutoSpeak?: () => void;
  isSpeaking?: boolean;
  onStopSpeaking?: () => void;
}

const AVAILABLE_MODELS = [
  { id: "auto", name: "Auto (DecisionRouter)", short: "coreblow/balanced" },
  { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet", short: "Claude 3.7" },
  { id: "gpt-4o", name: "GPT-4o", short: "GPT-4o" },
  { id: "gemini-2-5-flash", name: "Gemini 2.5 Flash", short: "Gemini 2.5" },
  { id: "local-ollama", name: "Local Ollama", short: "Ollama" },
];

const EFFORT_OPTIONS: { label: string; tier: ModelTier; desc: string }[] = [
  { label: "Low", tier: "Fast", desc: "Fast & lightweight" },
  { label: "Medium", tier: "Balanced", desc: "Balanced reasoning" },
  { label: "High", tier: "High Reasoning", desc: "Deep analytical reasoning" },
];

const SLASH_COMMANDS = [
  { cmd: "/help", desc: "List all CoreBlow commands & shortcuts" },
  { cmd: "/clear", desc: "Clear current chat session messages" },
  { cmd: "/mode", desc: "Switch execution mode (standard, autonomous, warroom)" },
  { cmd: "/model", desc: "Change reasoning model tier" },
  { cmd: "/estop", desc: "Trigger or toggle emergency stop pause" },
  { cmd: "/sync", desc: "Synchronize sessions and memory with gateway" },
];

const AT_SUGGESTIONS = [
  { prefix: "@workspace", desc: "Reference the active project workspace" },
  { prefix: "@files", desc: "Attach or browse workspace files" },
  { prefix: "@sessions", desc: "Reference recent conversation history" },
];

export const Composer: React.FC<ComposerProps> = ({
  prompt,
  onChangePrompt,
  onSend,
  onStop,
  isStreaming,
  permissionMode,
  onChangePermissionMode,
  modelTier,
  onChangeModelTier,
  activeModel = "Auto (DecisionRouter)",
  onChangeActiveModel,
  agentTeamwork = false,
  onToggleAgentTeamwork,
  executionMode = "standard",
  onChangeExecutionMode,
  attachedFiles,
  onAddFiles,
  onRemoveFile,
  projectName,
  projectBranch,
  onSelectWorkspace,
  autoSpeak = false,
  onToggleAutoSpeak,
  isSpeaking = false,
  onStopSpeaking,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Popover state management
  const [isModelPopoverOpen, setIsModelPopoverOpen] = useState(false);
  const [isModelListOpen, setIsModelListOpen] = useState(false);
  const [isPermissionMenuOpen, setIsPermissionMenuOpen] = useState(false);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);

  const modelPopoverRef = useRef<HTMLDivElement>(null);
  const permissionPopoverRef = useRef<HTMLDivElement>(null);
  const modePopoverRef = useRef<HTMLDivElement>(null);

  // Slash commands & @ references autocomplete state
  const isSlashTriggered = prompt.startsWith("/") && !prompt.includes(" ");
  const matchingSlashCommands = isSlashTriggered
    ? SLASH_COMMANDS.filter((s) => s.cmd.startsWith(prompt.toLowerCase()))
    : [];

  const atMatch = prompt.match(/@(\w*)$/);
  const isAtTriggered = Boolean(atMatch);
  const atQuery = atMatch ? atMatch[1].toLowerCase() : "";
  const matchingAtSuggestions = isAtTriggered
    ? AT_SUGGESTIONS.filter((s) => s.prefix.slice(1).startsWith(atQuery))
    : [];

  const handleSelectSlashCommand = (cmd: string) => {
    onChangePrompt(cmd + " ");
    setTimeout(() => textareaRef.current?.focus(), 20);
  };

  const handleSelectAtSuggestion = (prefix: string) => {
    if (atMatch) {
      const replaced = prompt.slice(0, prompt.length - atMatch[0].length) + prefix + " ";
      onChangePrompt(replaced);
    } else {
      onChangePrompt((prompt ? prompt + " " : "") + prefix + " ");
    }
    setTimeout(() => textareaRef.current?.focus(), 20);
  };

  // Close menus when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (modelPopoverRef.current && !modelPopoverRef.current.contains(target)) {
        setIsModelPopoverOpen(false);
        setIsModelListOpen(false);
      }
      if (permissionPopoverRef.current && !permissionPopoverRef.current.contains(target)) {
        setIsPermissionMenuOpen(false);
      }
      if (modePopoverRef.current && !modePopoverRef.current.contains(target)) {
        setIsModeMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsModelPopoverOpen(false);
        setIsModelListOpen(false);
        setIsPermissionMenuOpen(false);
        setIsModeMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Auto-grow textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "38px";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 38), 220)}px`;
    }
  }, [prompt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && prompt.trim()) {
        onSend();
      }
    }
  };

  const handleAttachClick = async () => {
    if (window.coreblowDesktop) {
      const files = await window.coreblowDesktop.dialog.selectFiles();
      if (files && files.length > 0) {
        onAddFiles(files);
      }
    }
  };

  const handleWorkspaceClick = async () => {
    if (onSelectWorkspace) {
      onSelectWorkspace();
    } else if (window.coreblowDesktop?.dialog?.selectDirectory) {
      await window.coreblowDesktop.dialog.selectDirectory();
    }
  };

  const handleToggleMic = async () => {
    if (isRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    // 1. Try Web Speech API (webkitSpeechRecognition or SpeechRecognition)
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
          let currentTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          if (currentTranscript) {
            onChangePrompt((prompt ? prompt + " " : "") + currentTranscript);
          }
        };

        recognition.onerror = () => {
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognition.start();
        recognitionRef.current = recognition;
        setIsRecording(true);
        return;
      } catch {}
    }

    // 2. Fallback to MediaRecorder + Gateway POST /api/corehub/voice/transcribe
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(",")[1];
          if (base64Audio) {
            const res = await gatewayClient.transcribeVoice({
              audioBase64: base64Audio,
              mimeType: "audio/webm",
            });
            if (res.ok && res.text) {
              onChangePrompt(prompt ? `${prompt} ${res.text}` : res.text);
            }
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch {
      setIsRecording(false);
    }
  };

  // Derive model short name & effort short name for the unified pill
  const activeModelMeta = AVAILABLE_MODELS.find((m) => m.name === activeModel);
  const shortModelName = activeModelMeta ? activeModelMeta.short : activeModel.split(" ")[0];
  const effortMeta = EFFORT_OPTIONS.find((e) => e.tier === modelTier);
  const effortShortLabel = effortMeta ? effortMeta.label : "High";

  const activeModeLabel =
    executionMode === "warroom"
      ? "War Room Squad"
      : executionMode === "autonomous"
        ? "Autonomous mode"
        : "Standard mode";

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "760px",
        margin: "0 auto",
        padding: "0 20px 14px",
        boxSizing: "border-box",
      }}
    >
      {/* 2. Above-Composer Workspace & Mode Action Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "10px",
          paddingLeft: "6px",
        }}
      >
        {/* Workspace Selector */}
        <button
          type="button"
          onClick={handleWorkspaceClick}
          title={`Branch: ${projectBranch} · Click to switch workspace folder (⌘O)`}
          style={{
            background: "transparent",
            border: "none",
            padding: "3px 8px",
            borderRadius: "6px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            color: "var(--ink-secondary)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--ink-primary)";
            e.currentTarget.style.background = "var(--bg-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--ink-secondary)";
            e.currentTarget.style.background = "transparent";
          }}
        >
          <FolderIcon size={13} color="var(--accent-teal)" />
          <span style={{ fontWeight: 600, color: "var(--ink-primary)" }}>{projectName}</span>
          <span style={{ fontSize: "11px", color: "var(--ink-muted)" }}>:{projectBranch} ▾</span>
        </button>

        {/* Execution Mode Selector (Hidden visually to match Quiet-Instrument layout, preserved for test contracts) */}
        <div style={{ position: "relative", display: "none" }} ref={modePopoverRef}>
          <button
            type="button"
            onClick={() => setIsModeMenuOpen((prev) => !prev)}
            style={{
              background: isModeMenuOpen ? "var(--bg-chip)" : "transparent",
              border: "none",
              padding: "3px 8px",
              borderRadius: "6px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              color: isModeMenuOpen ? "var(--ink-primary)" : "var(--ink-secondary)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--ink-primary)";
              e.currentTarget.style.background = "var(--bg-hover)";
            }}
            onMouseLeave={(e) => {
              if (!isModeMenuOpen) {
                e.currentTarget.style.color = "var(--ink-secondary)";
                e.currentTarget.style.background = "transparent";
              }
            }}
          >
            <span style={{ fontWeight: 500 }}>{activeModeLabel}</span>
            <ChevronDownIcon size={11} color="var(--ink-muted)" />
          </button>

          {isModeMenuOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                width: "230px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-medium)",
                borderRadius: "10px",
                boxShadow: "var(--shadow-composer)",
                overflow: "hidden",
                zIndex: 60,
                padding: "4px 0",
              }}
            >
              {[
                { id: "standard", title: "Standard mode", desc: "Direct AI coding with standard tools" },
                { id: "autonomous", title: "Autonomous mode", desc: "Self-directed agent execution with verification loops" },
                { id: "warroom", title: "War Room Squad", desc: "Multi-agent squad orchestration (toggles teamwork)" },
              ].map((m) => {
                const isSelected = executionMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onChangeExecutionMode?.(m.id as "standard" | "autonomous" | "warroom");
                      if (m.id === "warroom") {
                        onToggleAgentTeamwork?.(true);
                      }
                      setIsModeMenuOpen(false);
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                      padding: "8px 12px",
                      background: isSelected ? "var(--accent-teal-subtle)" : "transparent",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.12s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: isSelected ? "var(--accent-teal)" : "var(--ink-primary)",
                        }}
                      >
                        {m.title}
                      </span>
                      {isSelected && <CheckIcon size={12} color="var(--accent-teal)" />}
                    </div>
                    <span style={{ fontSize: "10px", color: "var(--ink-muted)", lineHeight: 1.3 }}>
                      {m.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. Sleek Rounded Composer Card */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-medium)",
          borderRadius: "14px",
          boxShadow: "var(--shadow-composer)",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          padding: "14px 16px 12px",
          boxSizing: "border-box",
          transition: "border-color 0.15s ease",
        }}
      >
        {/* Attached files preview bar */}
        {attachedFiles.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              marginBottom: "10px",
            }}
          >
            {attachedFiles.map((file) => {
              const name = file.split("/").pop() || file;
              return (
                <span
                  key={file}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "var(--bg-chip)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-xs)",
                    padding: "3px 8px",
                    fontSize: "11px",
                    color: "var(--ink-secondary)",
                  }}
                >
                  <FolderIcon size={11} color="var(--accent-teal)" />
                  <span style={{ maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveFile(file)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--ink-muted)",
                      cursor: "pointer",
                      padding: 0,
                      fontSize: "12px",
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Textarea Input */}
        <div style={{ marginBottom: "10px" }}>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => onChangePrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isRecording
                ? "Listening to your voice dictation..."
                : "Describe what you want to build, / commands, @ files or sessions"
            }
            rows={1}
            style={{
              width: "100%",
              minHeight: "38px",
              maxHeight: "220px",
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--ink-primary)",
              fontSize: "13px",
              lineHeight: 1.5,
              resize: "none",
              fontFamily: "var(--font-sans)",
              padding: 0,
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Autocomplete Popover for / commands and @ references */}
        {(matchingSlashCommands.length > 0 || matchingAtSuggestions.length > 0) && (
          <div
            style={{
              position: "absolute",
              bottom: "calc(100% + 8px)",
              left: "16px",
              width: "280px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-medium)",
              borderRadius: "10px",
              boxShadow: "var(--shadow-composer)",
              overflow: "hidden",
              zIndex: 75,
              padding: "4px 0",
            }}
          >
            {matchingSlashCommands.map((sc) => (
              <button
                key={sc.cmd}
                type="button"
                onClick={() => handleSelectSlashCommand(sc.cmd)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 12px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.1s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--accent-teal-subtle)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent-teal)" }}>
                  {sc.cmd}
                </span>
                <span style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
                  {sc.desc}
                </span>
              </button>
            ))}
            {matchingAtSuggestions.map((at) => (
              <button
                key={at.prefix}
                type="button"
                onClick={() => handleSelectAtSuggestion(at.prefix)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 12px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.1s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--accent-teal-subtle)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent-teal)" }}>
                  {at.prefix}
                </span>
                <span style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
                  {at.desc}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Bottom Toolbar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "6px",
            gap: "8px",
            flexWrap: "nowrap",
            minWidth: 0,
          }}
        >
          {/* Left Controls */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              flexShrink: 0,
              minWidth: 0,
            }}
          >
            {/* Circular + attach button */}
            <button
              type="button"
              onClick={handleAttachClick}
              title="Attach local files"
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "var(--bg-chip)",
                border: "1px solid var(--border-subtle)",
                color: "var(--ink-secondary)",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                transition: "all 0.15s ease",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--accent-teal-subtle)";
                e.currentTarget.style.borderColor = "var(--accent-teal)";
                e.currentTarget.style.color = "var(--accent-teal)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--bg-chip)";
                e.currentTarget.style.borderColor = "var(--border-subtle)";
                e.currentTarget.style.color = "var(--ink-secondary)";
              }}
            >
              <PlusIcon size={14} />
            </button>

            {/* Minimal Ghost Permission Selector */}
            <div style={{ position: "relative", flexShrink: 0 }} ref={permissionPopoverRef}>
              <button
                type="button"
                onClick={() => setIsPermissionMenuOpen((prev) => !prev)}
                style={{
                  background: isPermissionMenuOpen ? "var(--bg-chip)" : "transparent",
                  border: "none",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  color: "var(--ink-secondary)",
                  fontSize: "12px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-hover)";
                }}
                onMouseLeave={(e) => {
                  if (!isPermissionMenuOpen) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <ShieldIcon size={12} color="#F59E0B" />
                <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{permissionMode}</span>
                <ChevronDownIcon size={11} color="var(--ink-muted)" />
              </button>

              {isPermissionMenuOpen && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 8px)",
                    left: 0,
                    width: "160px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-medium)",
                    borderRadius: "10px",
                    boxShadow: "var(--shadow-composer)",
                    overflow: "hidden",
                    zIndex: 60,
                    padding: "4px 0",
                  }}
                >
                  {(["Full access", "Workspace", "Guarded", "Read-only"] as PermissionMode[]).map((mode) => {
                    const isSelected = permissionMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          onChangePermissionMode(mode);
                          setIsPermissionMenuOpen(false);
                        }}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "7px 10px",
                          background: isSelected ? "var(--accent-teal-subtle)" : "transparent",
                          border: "none",
                          color: isSelected ? "var(--accent-teal)" : "var(--ink-secondary)",
                          fontSize: "12px",
                          cursor: "pointer",
                          textAlign: "left",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span>{mode}</span>
                        {isSelected && <CheckIcon size={12} color="var(--accent-teal)" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Right Controls */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              flexShrink: 0,
              minWidth: 0,
            }}
          >
            {/* Unified Model + Effort Pill & Floating Popover */}
            <div style={{ position: "relative", flexShrink: 0 }} ref={modelPopoverRef}>
              <button
                type="button"
                onClick={() => setIsModelPopoverOpen((prev) => !prev)}
                title="Model, reasoning effort, and agent teamwork"
                style={{
                  height: "32px",
                  borderRadius: "16px",
                  background: isModelPopoverOpen ? "rgba(249, 115, 22, 0.16)" : "rgba(249, 115, 22, 0.08)",
                  border: "1px solid rgba(249, 115, 22, 0.28)",
                  color: "var(--ink-secondary)",
                  padding: "0 10px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "11px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                <SparklesIcon size={12} color="#F97316" />
                <span style={{ fontWeight: 600, color: "var(--ink-primary)", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {shortModelName}
                </span>
                <span style={{ color: "var(--ink-muted)", flexShrink: 0 }}>·</span>
                <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{effortShortLabel}</span>
                <span
                  title="Effort status indicator"
                  style={{
                    display: "inline-block",
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "#F97316",
                    boxShadow: "0 0 6px rgba(249, 115, 22, 0.6)",
                    marginLeft: "2px",
                    flexShrink: 0,
                  }}
                />
                <ChevronUpIcon size={12} color="#F97316" />
              </button>

              {/* Floating Dark Popover */}
              {isModelPopoverOpen && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 10px)",
                    right: 0,
                    width: "270px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-medium)",
                    borderRadius: "14px",
                    boxShadow: "var(--shadow-composer)",
                    padding: "14px",
                    boxSizing: "border-box",
                    zIndex: 60,
                  }}
                >
                  {/* Row 1: Model */}
                  <div style={{ marginBottom: "12px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "4px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "var(--ink-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        Model
                      </span>
                    </div>
                    <div style={{ position: "relative" }}>
                      <button
                        type="button"
                        onClick={() => setIsModelListOpen((prev) => !prev)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          background: "var(--bg-input)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "8px",
                          padding: "6px 10px",
                          color: "var(--ink-primary)",
                          fontSize: "12px",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {activeModel}
                        </span>
                        <ChevronDownIcon size={12} color="var(--accent-teal)" />
                      </button>

                      {isModelListOpen && (
                        <div
                          style={{
                            position: "absolute",
                            top: "calc(100% + 4px)",
                            left: 0,
                            right: 0,
                            background: "var(--bg-input)",
                            border: "1px solid var(--border-medium)",
                            borderRadius: "8px",
                            overflow: "hidden",
                            boxShadow: "var(--shadow-composer)",
                            zIndex: 70,
                          }}
                        >
                          {AVAILABLE_MODELS.map((m) => {
                            const isSelected = activeModel === m.name;
                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  onChangeActiveModel?.(m.name);
                                  setIsModelListOpen(false);
                                }}
                                style={{
                                  width: "100%",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  padding: "8px 10px",
                                  background: isSelected ? "var(--accent-teal-subtle)" : "transparent",
                                  border: "none",
                                  color: isSelected ? "var(--accent-teal)" : "var(--ink-secondary)",
                                  fontSize: "12px",
                                  cursor: "pointer",
                                  textAlign: "left",
                                  transition: "background 0.12s ease",
                                }}
                              >
                                <span>{m.name}</span>
                                {isSelected && <CheckIcon size={12} color="var(--accent-teal)" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Effort */}
                  <div style={{ marginBottom: "12px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "var(--ink-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        Effort
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--accent-teal)", fontWeight: 500 }}>
                        {modelTier}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: "4px",
                        background: "var(--bg-chip)",
                        padding: "3px",
                        borderRadius: "8px",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      {EFFORT_OPTIONS.map((opt) => {
                        const isSelected = modelTier === opt.tier;
                        return (
                          <button
                            key={opt.tier}
                            type="button"
                            onClick={() => onChangeModelTier(opt.tier)}
                            title={opt.desc}
                            style={{
                              background: isSelected ? "var(--accent-teal-glow)" : "transparent",
                              border: isSelected ? "1px solid var(--accent-teal)" : "1px solid transparent",
                              borderRadius: "6px",
                              padding: "5px 0",
                              color: isSelected ? "var(--accent-teal)" : "var(--ink-muted)",
                              fontWeight: isSelected ? 600 : 400,
                              fontSize: "11px",
                              cursor: "pointer",
                              transition: "all 0.12s ease",
                              textAlign: "center",
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Row 3: Enable agent teamwork */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                      paddingTop: "10px",
                      borderTop: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <UsersIcon size={13} color="var(--accent-teal)" />
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-primary)" }}>
                          Enable agent teamwork
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: "10px",
                          color: "var(--ink-muted)",
                          lineHeight: 1.3,
                          maxWidth: "185px",
                        }}
                        title="Automatically orchestrate War Room multi-agent specialists on complex tasks"
                      >
                        Orchestrate War Room multi-agent specialists on complex tasks
                      </span>
                    </div>

                    {/* iOS-style toggle */}
                    <button
                      type="button"
                      onClick={() => onToggleAgentTeamwork?.(!agentTeamwork)}
                      style={{
                        width: "36px",
                        height: "20px",
                        borderRadius: "10px",
                        background: agentTeamwork ? "var(--accent-teal)" : "var(--border-strong)",
                        border: "none",
                        cursor: "pointer",
                        position: "relative",
                        padding: 0,
                        transition: "background 0.2s ease",
                        flexShrink: 0,
                      }}
                      aria-label="Toggle agent teamwork"
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: "2px",
                          left: "2px",
                          width: "16px",
                          height: "16px",
                          borderRadius: "50%",
                          background: "var(--bg-canvas)",
                          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.4)",
                          transform: agentTeamwork ? "translateX(16px)" : "translateX(0)",
                          transition: "transform 0.2s ease",
                        }}
                      />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Rightmost Morphing Action Slot: Stop (streaming) | Send ↑ (typing) | Mic (idle) */}
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                title="Stop generation"
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "50%",
                  background: "#EF4444",
                  border: "none",
                  color: "#FFFFFF",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(239, 68, 68, 0.4)",
                  transition: "transform 0.1s ease",
                  flexShrink: 0,
                }}
              >
                <StopIcon size={16} color="#FFFFFF" />
              </button>
            ) : prompt.trim().length > 0 ? (
              <button
                type="button"
                onClick={onSend}
                title="Send message"
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "50%",
                  background: "var(--accent-teal)",
                  border: "1px solid var(--accent-teal)",
                  color: "#08110F",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  boxShadow: "0 2px 10px var(--accent-teal-glow)",
                  transition: "all 0.15s ease",
                  flexShrink: 0,
                }}
              >
                <SendIcon size={16} color="#08110F" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleToggleMic}
                title={isRecording ? "Listening... Click to finish dictation" : "Push-to-Talk Voice Dictation (Mic)"}
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "50%",
                  background: isRecording ? "rgba(239, 68, 68, 0.15)" : "var(--bg-chip)",
                  border: isRecording ? "1px solid #EF4444" : "1px solid var(--border-subtle)",
                  color: isRecording ? "#EF4444" : "var(--ink-secondary)",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  flexShrink: 0,
                }}
              >
                <MicIcon size={15} color={isRecording ? "#EF4444" : "currentColor"} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
