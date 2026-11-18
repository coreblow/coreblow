import React, { useState } from "react";
import { CheckIcon, CopyIcon } from "./Icons";

interface CodeBlockProps {
  language?: string;
  code: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language = "typescript", code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (window.coreblowDesktop) {
        await window.coreblowDesktop.clipboard.writeText(code);
      } else {
        await navigator.clipboard.writeText(code);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code", err);
    }
  };

  return (
    <div
      style={{
        margin: "12px 0",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-subtle)",
        background: "var(--bg-code)",
        overflow: "hidden",
        fontSize: "13px",
        fontFamily: "var(--font-mono)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          background: "rgba(0, 0, 0, 0.4)",
          borderBottom: "1px solid var(--border-subtle)",
          color: "var(--ink-secondary)",
          fontSize: "12px",
        }}
      >
        <span style={{ textTransform: "lowercase", fontWeight: 500, letterSpacing: "0.02em" }}>
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            background: "transparent",
            border: "none",
            color: copied ? "var(--accent-teal)" : "var(--ink-secondary)",
            cursor: "pointer",
            fontSize: "12px",
            padding: "2px 6px",
            borderRadius: "var(--radius-xs)",
            transition: "all 0.15s ease",
          }}
          title="Copy code to clipboard"
        >
          {copied ? <CheckIcon size={12} color="var(--accent-teal)" /> : <CopyIcon size={12} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <div style={{ padding: "12px", overflowX: "auto" }}>
        <pre style={{ margin: 0, lineHeight: 1.6, whiteSpace: "pre", color: "var(--ink-primary)" }}>
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};
