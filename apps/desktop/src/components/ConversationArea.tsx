import React, { useRef, useEffect } from "react";
import type { ChatMessage, ModelTier, PermissionMode } from "../types/gateway";
import { MessageBubble } from "./MessageBubble";
import { Composer } from "./Composer";
import { CoreBlowEmblem, SparklesIcon, TerminalIcon } from "./Icons";

interface ConversationAreaProps {
  messages: ChatMessage[];
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
}

export const ConversationArea: React.FC<ConversationAreaProps> = ({
  messages,
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
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as new content streams in
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  return (
    <div
      style={{
        flex: 1,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        background: "var(--bg-canvas)",
      }}
    >
      {/* Scrollable messages container */}
      <div
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 32px 140px", // 140px bottom pad leaves space for floating composer
          boxSizing: "border-box",
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "40px 20px",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "var(--radius-md)",
                background: "var(--bg-chip)",
                border: "1px solid var(--border-medium)",
                display: "grid",
                placeItems: "center",
                color: "var(--accent-teal)",
                marginBottom: "16px",
              }}
            >
              <CoreBlowEmblem size={26} />
            </div>

            <h2
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "var(--ink-primary)",
                letterSpacing: "0.02em",
                marginBottom: "6px",
              }}
            >
              CoreBlow Studio
            </h2>

            <p
              style={{
                fontSize: "13px",
                color: "var(--ink-secondary)",
                maxWidth: "440px",
                lineHeight: 1.6,
                marginBottom: "24px",
              }}
            >
              Autonomous Single-Brain engineering console. Wired to Gateway daemon on port 18789.
            </p>

            {/* Quick Action Suggestion Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                maxWidth: "520px",
                width: "100%",
              }}
            >
              {[
                {
                  icon: <TerminalIcon size={14} color="var(--accent-teal)" />,
                  title: "Run Verification Gates",
                  desc: "Audit test coverage and package builds",
                  prompt: "Run full 5-gate verification on our workspace and report status.",
                },
                {
                  icon: <SparklesIcon size={14} color="var(--accent-teal)" />,
                  title: "Inspect Cory Memory",
                  desc: "Query cognitive memory layers and active skills",
                  prompt: "Inspect Cory memory layers and list learned skills from the Gateway.",
                },
              ].map((card, i) => (
                <div
                  key={i}
                  onClick={() => onChangePrompt(card.prompt)}
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    padding: "12px",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    {card.icon}
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-primary)" }}>
                      {card.title}
                    </span>
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--ink-secondary)", lineHeight: 1.4 }}>
                    {card.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>
        )}
      </div>

      {/* Floating Composer Dock */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          pointerEvents: "none",
        }}
      >
        <div style={{ pointerEvents: "auto" }}>
          <Composer
            prompt={prompt}
            onChangePrompt={onChangePrompt}
            onSend={onSend}
            onStop={onStop}
            isStreaming={isStreaming}
            permissionMode={permissionMode}
            onChangePermissionMode={onChangePermissionMode}
            modelTier={modelTier}
            onChangeModelTier={onChangeModelTier}
            attachedFiles={attachedFiles}
            onAddFiles={onAddFiles}
            onRemoveFile={onRemoveFile}
            projectName={projectName}
            projectBranch={projectBranch}
          />
        </div>
      </div>
    </div>
  );
};
