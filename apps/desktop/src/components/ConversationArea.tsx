import React, { useRef, useEffect } from "react";
import type { ChatMessage, DesktopAgent, ModelTier, PermissionMode } from "../types/gateway";
import { MessageBubble } from "./MessageBubble";
import { Composer } from "./Composer";
import { CoreBlowEmblem } from "./Icons";
import { GettingStartedFlow, type GettingStartedFlowProps } from "./GettingStartedFlow";

export interface ConversationAreaProps {
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
  showOnboarding?: boolean;
  onboardingProps?: GettingStartedFlowProps;
  activeAgent?: DesktopAgent | null;
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
  activeModel,
  onChangeActiveModel,
  agentTeamwork,
  onToggleAgentTeamwork,
  executionMode,
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
  showOnboarding = false,
  onboardingProps,
  activeAgent = null,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as new content streams in
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const composerElement = (
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
      activeModel={activeModel}
      onChangeActiveModel={onChangeActiveModel}
      agentTeamwork={agentTeamwork}
      onToggleAgentTeamwork={onToggleAgentTeamwork}
      executionMode={executionMode}
      onChangeExecutionMode={onChangeExecutionMode}
      attachedFiles={attachedFiles}
      onAddFiles={onAddFiles}
      onRemoveFile={onRemoveFile}
      projectName={projectName}
      projectBranch={projectBranch}
      onSelectWorkspace={onSelectWorkspace}
      autoSpeak={autoSpeak}
      onToggleAutoSpeak={onToggleAutoSpeak}
      isSpeaking={isSpeaking}
      onStopSpeaking={onStopSpeaking}
    />
  );

  return (
    <div
      style={{
        flex: 1,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        background: "var(--bg-canvas, #060B09)",
      }}
    >
      {showOnboarding && onboardingProps ? (
        <div
          ref={scrollContainerRef}
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            boxSizing: "border-box",
          }}
        >
          <GettingStartedFlow {...onboardingProps} />
        </div>
      ) : messages.length === 0 && activeAgent ? (
        /* Dedicated Agent Mode Empty State: Centered vertically in exact alignment with Sessions */
        <div
          ref={scrollContainerRef}
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px 24px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              maxWidth: "780px",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "14px",
                  background: `${activeAgent.accentColor}22`,
                  border: `1px solid ${activeAgent.accentColor}55`,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <CoreBlowEmblem size={32} color={activeAgent.accentColor} />
              </div>
              <h1
                style={{
                  fontSize: "40px",
                  fontWeight: 800,
                  color: "var(--ink-primary)",
                  letterSpacing: "0.08em",
                  margin: 0,
                  lineHeight: 1.08,
                  textTransform: "uppercase",
                  textAlign: "center",
                }}
              >
                {activeAgent.name}
              </h1>
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--ink-muted)",
                  margin: 0,
                  textAlign: "center",
                }}
              >
                {activeAgent.tagline || "Say something to get started."}
              </p>
            </div>
            <div style={{ width: "100%", marginTop: "28px" }}>
              {composerElement}
            </div>
          </div>
        </div>
      ) : messages.length === 0 ? (
        /* 1. Centered Hero Empty State */
        <div
          ref={scrollContainerRef}
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px 24px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              maxWidth: "780px",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {/* Brand Hero — exact same scale & stacked proportions as Agent mode */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "14px",
              }}
            >
              <CoreBlowEmblem size={64} color="var(--accent-teal)" />
              <h1
                style={{
                  fontSize: "40px",
                  fontWeight: 800,
                  color: "var(--ink-primary)",
                  letterSpacing: "0.08em",
                  margin: 0,
                  lineHeight: 1.08,
                  textTransform: "uppercase",
                  textAlign: "center",
                }}
              >
                CoreBlow
              </h1>
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--ink-muted)",
                  margin: 0,
                  textAlign: "center",
                }}
              >
                Say something to get started.
              </p>
              <span
                style={{
                  display: "none",
                }}
              >
                v2.0
              </span>
            </div>

            {/* The Composer rendered directly below the hero title with marginTop: 28px */}
            <div style={{ width: "100%", marginTop: "28px" }}>
              {composerElement}
            </div>
          </div>
        </div>
      ) : (
        /* Scrolling conversation thread with floating dock composer */
        <>
          <div
            ref={scrollContainerRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "20px 32px 140px", // leaves space for bottom floating dock
              boxSizing: "border-box",
            }}
          >
            <div style={{ maxWidth: "800px", margin: "0 auto" }}>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </div>
          </div>

          {/* Bottom Floating Composer Dock with smooth fade gradient */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              pointerEvents: "none",
              background: "linear-gradient(to top, var(--bg-canvas) 65%, transparent)",
              paddingTop: "24px",
            }}
          >
            <div style={{ pointerEvents: "auto" }}>
              {composerElement}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
