import React, { useRef, useEffect } from "react";
import type { ChatMessage, ModelTier, PermissionMode } from "../types/gateway";
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
        background: "var(--bg-canvas, #08110F)",
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
            {/* Brand Hero Row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
              }}
            >
              <CoreBlowEmblem size={28} color="#2DD4BF" />
              <h1
                style={{
                  fontSize: "26px",
                  fontWeight: 700,
                  color: "#D9FBF3",
                  letterSpacing: "-0.02em",
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                CoreBlow Studio
              </h1>
              <span
                style={{
                  background: "rgba(45, 212, 191, 0.14)",
                  color: "#2DD4BF",
                  border: "1px solid rgba(45, 212, 191, 0.25)",
                  borderRadius: "9999px",
                  padding: "2px 8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.03em",
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

          {/* Bottom Floating Composer Dock */}
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
              {composerElement}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
