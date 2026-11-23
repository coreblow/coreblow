import React, { useState, useEffect, useRef } from "react";
import type { ActiveProjectState } from "../../types/gateway";

interface LocalTerminalTabProps {
  project: ActiveProjectState;
  sessionKey?: string;
}

interface OutputEntry {
  id: string;
  type: "prompt" | "stdout" | "stderr";
  text: string;
}

export const LocalTerminalTab: React.FC<LocalTerminalTabProps> = ({
  project,
  sessionKey = "default",
}) => {
  const [terminalInfo, setTerminalInfo] = useState<{
    shell: string;
    cwd: string;
    username: string;
    hostname: string;
    platform: string;
  }>({
    shell: "/bin/zsh",
    cwd: project.path,
    username: "developer",
    hostname: "mac",
    platform: "darwin",
  });

  const [cwd, setCwd] = useState(project.path);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const [currentInput, setCurrentInput] = useState("");
  const [entries, setEntries] = useState<OutputEntry[]>([]);
  const [, setIsExecuting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch real machine username, hostname, shell
  useEffect(() => {
    let mounted = true;
    async function initInfo() {
      if (window.coreblowDesktop?.terminal?.getInfo) {
        try {
          const info = await window.coreblowDesktop.terminal.getInfo(cwd);
          if (mounted) {
            setTerminalInfo(info);
            setCwd(info.cwd);
          }
        } catch (err) {
          console.error("Failed to get terminal info:", err);
        }
      } else {
        // Fallback for tests/browser
        setTerminalInfo({
          shell: "/bin/zsh",
          cwd: project.path,
          username: "febrinanda",
          hostname: "febrinandas-Mac-mini",
          platform: "darwin",
        });
      }
    }
    initInfo();
    return () => {
      mounted = false;
    };
  }, [project.path]);

  // Auto focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, [sessionKey]);

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [entries, currentInput]);

  // Strip ANSI color codes helper
  const cleanAnsi = (str: string) => str.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, "");

  // Compute folder name for prompt
  const folderName = cwd.split("/").filter(Boolean).pop() || project.name;
  const promptSymbol = terminalInfo.shell.includes("zsh") ? "%" : "$";
  const promptText = `${terminalInfo.username}@${terminalInfo.hostname} ${folderName} ${promptSymbol} `;

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const cmd = currentInput;
      const trimmed = cmd.trim();
      setCurrentInput("");
      setHistoryIdx(-1);

      if (!trimmed) {
        setEntries((prev) => [
          ...prev,
          { id: `cmd-${Date.now()}`, type: "prompt", text: promptText },
        ]);
        return;
      }

      setHistory((prev) => [...prev, trimmed]);

      if (trimmed === "clear") {
        setEntries([]);
        return;
      }

      // Add the command line to output entries
      const cmdEntry: OutputEntry = {
        id: `cmd-${Date.now()}`,
        type: "prompt",
        text: `${promptText}${cmd}`,
      };
      setEntries((prev) => [...prev, cmdEntry]);

      // Execute command
      if (window.coreblowDesktop?.terminal?.exec) {
        setIsExecuting(true);
        try {
          const res = await window.coreblowDesktop.terminal.exec(trimmed, cwd);
          const newEntries: OutputEntry[] = [];

          if (res.stdout) {
            const lines = cleanAnsi(res.stdout).split("\n");
            if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
            for (let i = 0; i < lines.length; i++) {
              newEntries.push({ id: `out-${Date.now()}-${i}`, type: "stdout", text: lines[i] });
            }
          }

          if (res.stderr) {
            const lines = cleanAnsi(res.stderr).split("\n");
            if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
            for (let i = 0; i < lines.length; i++) {
              newEntries.push({ id: `err-${Date.now()}-${i}`, type: "stderr", text: lines[i] });
            }
          }

          setEntries((prev) => [...prev, ...newEntries]);
        } catch (err: any) {
          setEntries((prev) => [
            ...prev,
            { id: `err-${Date.now()}`, type: "stderr", text: err?.message || "Execution error" },
          ]);
        } finally {
          setIsExecuting(false);
        }
      } else {
        // Test fallback
        const lower = trimmed.toLowerCase();
        const newEntries: OutputEntry[] = [];
        if (lower === "pwd") {
          newEntries.push({ id: `out-${Date.now()}`, type: "stdout", text: cwd });
        } else if (lower === "ls" || lower === "ls -la") {
          newEntries.push(
            { id: `out-${Date.now()}-1`, type: "stdout", text: "apps           coreblow.config.json package.json       src" },
            { id: `out-${Date.now()}-2`, type: "stdout", text: "docs           extensions          pnpm-lock.yaml     ui" },
          );
        } else if (lower.startsWith("git status")) {
          newEntries.push(
            { id: `out-${Date.now()}-1`, type: "stdout", text: `On branch ${project.branch}` },
            { id: `out-${Date.now()}-2`, type: "stdout", text: "nothing to commit, working tree clean" },
          );
        } else {
          newEntries.push({ id: `out-${Date.now()}`, type: "stdout", text: `[simulated output] ${trimmed}` });
        }
        setEntries((prev) => [...prev, ...newEntries]);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(nextIdx);
      setCurrentInput(history[nextIdx] || "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx === -1) return;
      if (historyIdx < history.length - 1) {
        const nextIdx = historyIdx + 1;
        setHistoryIdx(nextIdx);
        setCurrentInput(history[nextIdx] || "");
      } else {
        setHistoryIdx(-1);
        setCurrentInput("");
      }
    } else if (e.ctrlKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      setEntries((prev) => [
        ...prev,
        { id: `cancel-${Date.now()}`, type: "prompt", text: `${promptText}${currentInput}^C` },
      ]);
      setCurrentInput("");
      setHistoryIdx(-1);
    } else if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      setEntries([]);
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      style={{
        flex: 1,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-canvas)",
        padding: "12px 16px",
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
        fontSize: "12px",
        lineHeight: 1.6,
        color: "var(--ink-primary)",
        boxSizing: "border-box",
        overflowY: "auto",
        cursor: "text",
        position: "relative",
      }}
    >
      {/* Hidden native input capturing all keyboard and composition events */}
      <input
        ref={inputRef}
        type="text"
        value={currentInput}
        onChange={(e) => setCurrentInput(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          opacity: 0,
          width: "1px",
          height: "1px",
          pointerEvents: "none",
        }}
      />

      {/* Rendered Past Lines */}
      {entries.map((entry) => (
        <div
          key={entry.id}
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            color:
              entry.type === "stderr"
                ? "#F87171"
                : entry.type === "prompt"
                ? "var(--ink-primary)"
                : "var(--ink-primary)",
          }}
        >
          {entry.text}
        </div>
      ))}

      {/* Active Command Prompt Line */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        <span style={{ color: "var(--ink-secondary)", userSelect: "none" }}>
          {promptText}
        </span>
        <span style={{ color: "var(--ink-primary)" }}>{currentInput}</span>
        <span
          style={{
            display: "inline-block",
            width: "7px",
            height: "14px",
            background: "var(--ink-primary)",
            verticalAlign: "middle",
            marginLeft: "2px",
            animation: "terminal-blink 1s step-end infinite",
          }}
        />
      </div>

      <div ref={bottomRef} />
    </div>
  );
};
