import React, { useRef, useEffect, useState } from "react";
import type { ModelTier, PermissionMode } from "../types/gateway";
import { gatewayClient } from "../services/gateway-client";
import {
  FolderIcon,
  GitBranchIcon,
  MicIcon,
  PlusIcon,
  SendIcon,
  ShieldIcon,
  SparklesIcon,
  SpeakerIcon,
  StopIcon,
  VolumeXIcon,
} from "./Icons";

interface ComposerProps {
  prompt: string;
  onChangePrompt: (val: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  permissionMode: PermissionMode;
  onChangePermissionMode: (mode: PermissionMode) => void;
  modelTier: ModelTier;
  onChangeModelTier: (tier: ModelTier) => void;
  attachedFiles: string[];
  onAddFiles: (paths: string[]) => void;
  onRemoveFile: (path: string) => void;
  projectName: string;
  projectBranch: string;
  autoSpeak?: boolean;
  onToggleAutoSpeak?: () => void;
  isSpeaking?: boolean;
  onStopSpeaking?: () => void;
}

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
  attachedFiles,
  onAddFiles,
  onRemoveFile,
  projectName,
  projectBranch,
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

  // Auto-grow textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "36px";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 36), 220)}px`;
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

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "var(--composer-max-width)",
        margin: "0 auto",
        padding: "0 24px 14px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          background: "var(--bg-input)",
          border: "1px solid var(--border-medium)",
          borderRadius: "var(--radius-panel)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.45)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
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
              padding: "8px 12px 0",
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
                    padding: "2px 8px",
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

        {/* Top Tier: Input Textarea */}
        <div style={{ padding: "10px 14px 4px" }}>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => onChangePrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? "Listening to your voice dictation..." : "Ask CoreBlow anything, analyze workspace code, or trigger tools..."}
            rows={1}
            style={{
              width: "100%",
              minHeight: "36px",
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
            }}
          />
        </div>

        {/* Bottom Tier: Toolbar Controls */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 10px 8px",
            borderTop: "1px solid rgba(45, 212, 191, 0.04)",
          }}
        >
          {/* Left Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={handleAttachClick}
              title="Attach local files"
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "var(--radius-full)",
                background: "var(--bg-chip)",
                border: "1px solid var(--border-subtle)",
                color: "var(--ink-secondary)",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <PlusIcon size={14} />
            </button>

            {/* Project / Git chip */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "2px 8px",
                background: "var(--bg-chip)",
                borderRadius: "var(--radius-xs)",
                border: "1px solid var(--border-subtle)",
                fontSize: "11px",
                color: "var(--ink-secondary)",
              }}
            >
              <GitBranchIcon size={11} color="var(--accent-teal)" />
              <span>{projectName}:{projectBranch}</span>
            </div>

            {/* 4 Permission Modes Selector */}
            <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
              <select
                value={permissionMode}
                onChange={(e) => onChangePermissionMode(e.target.value as PermissionMode)}
                style={{
                  background: "var(--bg-chip)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-xs)",
                  color: "var(--ink-secondary)",
                  fontSize: "11px",
                  padding: "4px 8px 4px 22px",
                  outline: "none",
                  cursor: "pointer",
                  appearance: "none",
                }}
              >
                <option value="Full access">Full access</option>
                <option value="Workspace">Workspace</option>
                <option value="Guarded">Guarded</option>
                <option value="Read-only">Read-only</option>
              </select>
              <span style={{ position: "absolute", left: "6px", pointerEvents: "none", color: "var(--accent-teal)" }}>
                <ShieldIcon size={11} />
              </span>
            </div>
          </div>

          {/* Right Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Live Push-to-Talk Mic Dictation */}
            <button
              type="button"
              onClick={handleToggleMic}
              title={isRecording ? "Listening... Click to finish dictation" : "Push-to-Talk Voice Dictation (Mic)"}
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "var(--radius-sm)",
                background: isRecording ? "rgba(239, 68, 68, 0.2)" : "var(--bg-chip)",
                border: isRecording ? "1px solid #EF4444" : "1px solid var(--border-subtle)",
                color: isRecording ? "#EF4444" : "var(--ink-secondary)",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <MicIcon size={14} color={isRecording ? "#EF4444" : "currentColor"} />
            </button>

            {/* Auto-Speak Replies Toggle */}
            <button
              type="button"
              onClick={isSpeaking ? onStopSpeaking : onToggleAutoSpeak}
              title={
                isSpeaking
                  ? "Speaking reply. Click to stop (Silence)"
                  : autoSpeak
                    ? "Auto-Speak Replies enabled (Click to mute)"
                    : "Auto-Speak Replies disabled (Click to enable)"
              }
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "var(--radius-sm)",
                background: isSpeaking
                  ? "rgba(45, 212, 191, 0.2)"
                  : autoSpeak
                    ? "rgba(45, 212, 191, 0.1)"
                    : "var(--bg-chip)",
                border: isSpeaking || autoSpeak ? "1px solid rgba(45, 212, 191, 0.3)" : "1px solid var(--border-subtle)",
                color: isSpeaking || autoSpeak ? "var(--accent-teal)" : "var(--ink-muted)",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {isSpeaking ? (
                <SpeakerIcon size={14} color="var(--accent-teal)" />
              ) : autoSpeak ? (
                <SpeakerIcon size={14} color="var(--accent-teal)" />
              ) : (
                <VolumeXIcon size={14} color="var(--ink-muted)" />
              )}
            </button>

            {/* Model Tier Selector */}
            <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
              <select
                value={modelTier}
                onChange={(e) => onChangeModelTier(e.target.value as ModelTier)}
                style={{
                  background: "var(--bg-chip)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-xs)",
                  color: "var(--ink-secondary)",
                  fontSize: "11px",
                  padding: "4px 8px 4px 22px",
                  outline: "none",
                  cursor: "pointer",
                  appearance: "none",
                }}
              >
                <option value="Fast">Fast</option>
                <option value="Balanced">Balanced</option>
                <option value="High Reasoning">High Reasoning</option>
              </select>
              <span style={{ position: "absolute", left: "6px", pointerEvents: "none", color: "var(--accent-teal)" }}>
                <SparklesIcon size={11} />
              </span>
            </div>

            {/* Send / Stop Button */}
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                title="Stop generation"
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "var(--radius-full)",
                  background: "#EF4444",
                  border: "none",
                  color: "#FFFFFF",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(239, 68, 68, 0.4)",
                  transition: "transform 0.1s ease",
                }}
              >
                <StopIcon size={16} color="#FFFFFF" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onSend}
                disabled={!prompt.trim()}
                title="Send message"
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "var(--radius-full)",
                  background: prompt.trim() ? "var(--accent-teal)" : "rgba(45, 212, 191, 0.2)",
                  border: "none",
                  color: prompt.trim() ? "#08110F" : "rgba(255, 255, 255, 0.4)",
                  display: "grid",
                  placeItems: "center",
                  cursor: prompt.trim() ? "pointer" : "default",
                  boxShadow: prompt.trim() ? "0 2px 8px var(--accent-teal-glow)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                <SendIcon size={16} color={prompt.trim() ? "#08110F" : "rgba(255, 255, 255, 0.4)"} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
