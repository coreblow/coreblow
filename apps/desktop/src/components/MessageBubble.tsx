import React, { useState } from "react";
import type { ChatMessage } from "../types/gateway";
import { CodeBlock } from "./CodeBlock";
import { ExecutionCard } from "./ExecutionCard";
import { CheckIcon, CopyIcon } from "./Icons";

interface MessageBubbleProps {
  message: ChatMessage;
}

/**
 * Simple, robust Markdown parser that decomposes text into paragraphs, headers,
 * lists, inline code, and code fences.
 */
function renderMarkdownContent(content: string) {
  if (!content) return null;

  // Split content by code fences ```[lang]\n...\n```
  const fenceRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(content)) !== null) {
    const textBefore = content.substring(lastIndex, match.index);
    if (textBefore.trim()) {
      elements.push(
        <div key={`text-${lastIndex}`} style={{ lineHeight: 1.6, margin: "6px 0" }}>
          {renderTextParagraphs(textBefore)}
        </div>,
      );
    }

    const language = match[1] || "text";
    const code = match[2];
    elements.push(<CodeBlock key={`code-${match.index}`} language={language} code={code} />);

    lastIndex = match.index + match[0].length;
  }

  const trailingText = content.substring(lastIndex);
  if (trailingText.trim()) {
    elements.push(
      <div key={`text-${lastIndex}`} style={{ lineHeight: 1.6, margin: "6px 0" }}>
        {renderTextParagraphs(trailingText)}
      </div>,
    );
  }

  return elements;
}

function renderTextParagraphs(text: string) {
  const lines = text.split("\n");
  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return <div key={idx} style={{ height: "8px" }} />;
    }

    // Headings
    if (trimmed.startsWith("### ")) {
      return (
        <h4 key={idx} style={{ fontSize: "14px", fontWeight: 600, color: "var(--ink-primary)", margin: "8px 0 4px" }}>
          {renderInlineFormatting(trimmed.substring(4))}
        </h4>
      );
    }
    if (trimmed.startsWith("## ")) {
      return (
        <h3 key={idx} style={{ fontSize: "15px", fontWeight: 600, color: "var(--ink-primary)", margin: "10px 0 4px" }}>
          {renderInlineFormatting(trimmed.substring(3))}
        </h3>
      );
    }
    if (trimmed.startsWith("# ")) {
      return (
        <h2 key={idx} style={{ fontSize: "16px", fontWeight: 700, color: "var(--ink-primary)", margin: "12px 0 6px" }}>
          {renderInlineFormatting(trimmed.substring(2))}
        </h2>
      );
    }

    // Bullet points
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      return (
        <div key={idx} style={{ display: "flex", gap: "8px", margin: "3px 0 3px 8px" }}>
          <span style={{ color: "var(--accent-teal)" }}>•</span>
          <span>{renderInlineFormatting(trimmed.substring(2))}</span>
        </div>
      );
    }

    return (
      <p key={idx} style={{ margin: "4px 0" }}>
        {renderInlineFormatting(line)}
      </p>
    );
  });
}

function renderInlineFormatting(text: string) {
  // Split on bold (**text**) and inline code (`code`)
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} style={{ color: "var(--ink-primary)", fontWeight: 600 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          style={{
            fontFamily: "var(--font-mono)",
            background: "rgba(45, 212, 191, 0.08)",
            color: "var(--accent-teal)",
            padding: "2px 5px",
            borderRadius: "var(--radius-xs)",
            fontSize: "12px",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    try {
      if (window.coreblowDesktop?.clipboard) {
        await window.coreblowDesktop.clipboard.writeText(message.content);
      } else if (navigator?.clipboard) {
        await navigator.clipboard.writeText(message.content);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy message", err);
    }
  };

  if (isUser) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          margin: "16px 0",
        }}
      >
        <div
          style={{
            maxWidth: "75%",
            background: "var(--bg-chip)",
            border: "1px solid var(--border-medium)",
            borderRadius: "var(--radius-lg)",
            padding: "10px 16px",
            color: "var(--ink-primary)",
            fontSize: "14px",
            lineHeight: 1.5,
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
          }}
        >
          {message.attachedFiles && message.attachedFiles.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
                marginBottom: "8px",
                paddingBottom: "8px",
                borderBottom: "1px solid rgba(45, 212, 191, 0.15)",
              }}
            >
              {message.attachedFiles.map((file) => {
                const name = file.split("/").pop() || file;
                return (
                  <span
                    key={file}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      background: "rgba(0, 0, 0, 0.3)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-xs)",
                      padding: "2px 6px",
                      fontSize: "11px",
                      color: "var(--accent-teal)",
                    }}
                  >
                    <span>📎</span>
                    <span style={{ maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {name}
                    </span>
                  </span>
                );
              })}
            </div>
          )}
          <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{message.content}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "block",
        margin: "18px 0",
        width: "100%",
        minWidth: 0,
        fontSize: "14px",
        lineHeight: 1.65,
        color: "var(--ink-primary)",
        background: "transparent",
        border: "none",
      }}
    >
      {/* Tool Execution Steps */}
      {message.toolSteps && message.toolSteps.length > 0 && (
        <div style={{ marginBottom: "10px" }}>
          {message.toolSteps.map((step, idx) => (
            <ExecutionCard key={`${step.stepIndex}-${idx}`} step={step} />
          ))}
        </div>
      )}

      {/* Message Markdown Content */}
      <div style={{ wordBreak: "break-word" }}>
        {renderMarkdownContent(message.content)}
        {message.streaming && (
          <span
            className="animate-pulse"
            style={{
              display: "inline-block",
              width: "7px",
              height: "15px",
              background: "var(--accent-teal)",
              marginLeft: "4px",
              verticalAlign: "middle",
              borderRadius: "1px",
            }}
          />
        )}
      </div>

      {/* Error notification if turn failed */}
      {message.error && (
        <div
          className="message-error"
          style={{
            marginTop: message.content ? "8px" : "0",
            color: "var(--state-error, #F87171)",
            fontSize: "13px",
            lineHeight: 1.5,
          }}
        >
          Error: {message.error}
        </div>
      )}

      {/* Subtle Copy button */}
      {!message.streaming && message.content.trim().length > 0 && (
        <div style={{ marginTop: "8px", display: "flex", alignItems: "center" }}>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy message"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 6px",
              background: "transparent",
              border: "none",
              color: copied ? "var(--accent-teal)" : "var(--ink-muted)",
              fontSize: "12px",
              cursor: "pointer",
              borderRadius: "var(--radius-xs)",
              transition: "color 0.15s ease",
            }}
            title={copied ? "Copied" : "Copy"}
          >
            {copied ? <CheckIcon size={13} color="var(--accent-teal)" /> : <CopyIcon size={13} />}
            <span style={{ fontSize: "11px" }}>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      )}
    </div>
  );
};
