import React, { useState, useEffect, useRef } from "react";
import type { ActiveProjectState } from "../../types/gateway";
import { TerminalIcon, TrashIcon } from "../Icons";

interface LocalTerminalTabProps {
  project: ActiveProjectState;
}

interface TerminalLine {
  id: string;
  type: "system" | "command" | "stdout" | "stderr";
  text: string;
}

export const LocalTerminalTab: React.FC<LocalTerminalTabProps> = ({ project }) => {
  const [terminalInfo, setTerminalInfo] = useState<{
    shell: string;
    cwd: string;
    username: string;
    hostname: string;
    platform: string;
  } | null>(null);

  const [inputVal, setInputVal] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lines, setLines] = useState<TerminalLine[]>([]);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load terminal environment information on mount or project change
  useEffect(() => {
    let mounted = true;

    async function loadInfo() {
      if (window.coreblowDesktop?.terminal?.getInfo) {
        try {
          const info = await window.coreblowDesktop.terminal.getInfo(project.path);
          if (mounted) {
            setTerminalInfo(info);
            const shellName = info.shell.split("/").pop() || info.shell;
            setLines([
              {
                id: "init-1",
                type: "system",
                text: `● Connected to local terminal: ${shellName} (${info.shell})`,
              },
              {
                id: "init-2",
                type: "system",
                text: `  Workspace: ${project.path}  ·  branch: ${project.branch}`,
              },
              {
                id: "init-3",
                type: "system",
                text: "  Type any shell command (ls, pwd, git status, pnpm, node) or launch System Terminal ↗",
              },
            ]);
          }
        } catch (err) {
          console.error("Failed to fetch terminal info:", err);
        }
      } else {
        // Fallback for browser dev mode or tests
        setTerminalInfo({
          shell: "/bin/zsh",
          cwd: project.path,
          username: "developer",
          hostname: "coreblow-station",
          platform: "darwin",
        });
        setLines([
          {
            id: "init-1",
            type: "system",
            text: `● Connected to local terminal: zsh (/bin/zsh)`,
          },
          {
            id: "init-2",
            type: "system",
            text: `  Workspace: ${project.path}  ·  branch: ${project.branch}`,
          },
          {
            id: "init-3",
            type: "system",
            text: "  Type any shell command (ls, pwd, git status, pnpm, node) or launch System Terminal ↗",
          },
        ]);
      }
    }

    loadInfo();
    return () => {
      mounted = false;
    };
  }, [project.path, project.branch]);

  // Auto-scroll on new output
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [lines, isExecuting]);

  // Focus input when tab is active
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleLaunchExternalTerminal = async () => {
    if (window.coreblowDesktop?.terminal?.openExternal) {
      await window.coreblowDesktop.terminal.openExternal(project.path);
      setLines((prev) => [
        ...prev,
        {
          id: `ext-${Date.now()}`,
          type: "system",
          text: `[Launched macOS native Terminal.app at ${project.path}]`,
        },
      ]);
    }
  };

  const handleClear = () => {
    setLines([]);
  };

  const executeCommand = async (cmdToRun: string) => {
    const rawCmd = cmdToRun.trim();
    if (!rawCmd) return;

    // Command history
    setHistory((prev) => [...prev, rawCmd]);
    setHistoryIdx(-1);
    setInputVal("");

    if (rawCmd.toLowerCase() === "clear") {
      handleClear();
      return;
    }

    // Prompt line
    const promptPrefix = terminalInfo
      ? `${terminalInfo.username}@${terminalInfo.hostname} ${project.name} %`
      : `$`;

    const cmdEntry: TerminalLine = {
      id: `cmd-${Date.now()}`,
      type: "command",
      text: `${promptPrefix} ${rawCmd}`,
    };

    setLines((prev) => [...prev, cmdEntry]);

    if (window.coreblowDesktop?.terminal?.exec) {
      setIsExecuting(true);
      try {
        const res = await window.coreblowDesktop.terminal.exec(rawCmd, project.path);
        const newEntries: TerminalLine[] = [];

        if (res.stdout) {
          const stdoutLines = res.stdout.split("\n");
          // Remove trailing empty line if present
          if (stdoutLines.length > 0 && stdoutLines[stdoutLines.length - 1] === "") {
            stdoutLines.pop();
          }
          for (let i = 0; i < stdoutLines.length; i++) {
            newEntries.push({
              id: `out-${Date.now()}-${i}`,
              type: "stdout",
              text: stdoutLines[i],
            });
          }
        }

        if (res.stderr) {
          const stderrLines = res.stderr.split("\n");
          if (stderrLines.length > 0 && stderrLines[stderrLines.length - 1] === "") {
            stderrLines.pop();
          }
          for (let i = 0; i < stderrLines.length; i++) {
            newEntries.push({
              id: `err-${Date.now()}-${i}`,
              type: "stderr",
              text: stderrLines[i],
            });
          }
        }

        if (res.exitCode !== 0 && !res.stderr) {
          newEntries.push({
            id: `code-${Date.now()}`,
            type: "stderr",
            text: `[Process exited with code ${res.exitCode}]`,
          });
        }

        setLines((prev) => [...prev, ...newEntries]);
      } catch (err: any) {
        setLines((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            type: "stderr",
            text: err?.message || "Execution failed",
          },
        ]);
      } finally {
        setIsExecuting(false);
      }
    } else {
      // Fallback for tests/browser
      const lower = rawCmd.toLowerCase();
      const newEntries: TerminalLine[] = [];

      if (lower === "pwd") {
        newEntries.push({ id: `out-${Date.now()}`, type: "stdout", text: project.path });
      } else if (lower === "ls" || lower === "ls -la") {
        newEntries.push(
          { id: `out-${Date.now()}-1`, type: "stdout", text: "apps/           coreblow.config.json  package.json       src/" },
          { id: `out-${Date.now()}-2`, type: "stdout", text: "docs/           extensions/           pnpm-lock.yaml     ui/" },
        );
      } else if (lower.startsWith("git status")) {
        newEntries.push(
          { id: `out-${Date.now()}-1`, type: "stdout", text: `On branch ${project.branch}` },
          { id: `out-${Date.now()}-2`, type: "stdout", text: `Your branch is up to date with 'origin/${project.branch}'.` },
        );
      } else {
        newEntries.push({
          id: `out-${Date.now()}`,
          type: "stdout",
          text: `[simulated exec] ${rawCmd}: exit code 0`,
        });
      }

      setLines((prev) => [...prev, ...newEntries]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(nextIdx);
      setInputVal(history[nextIdx]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx === -1) return;
      if (historyIdx < history.length - 1) {
        const nextIdx = historyIdx + 1;
        setHistoryIdx(nextIdx);
        setInputVal(history[nextIdx]);
      } else {
        setHistoryIdx(-1);
        setInputVal("");
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeCommand(inputVal);
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-code)",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Top Hairline Status & Quick Actions Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-canvas)",
          fontSize: "11px",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: "var(--accent-teal)",
              boxShadow: "0 0 6px var(--accent-teal)",
              flexShrink: 0,
            }}
          />
          <span style={{ fontWeight: 600, color: "var(--ink-primary)" }}>
            Local Terminal
          </span>
          {terminalInfo?.shell && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                color: "var(--ink-muted)",
                background: "var(--bg-chip)",
                padding: "1px 5px",
                borderRadius: "3px",
              }}
            >
              {terminalInfo.shell.split("/").pop()}
            </span>
          )}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "var(--ink-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={project.path}
          >
            {project.name}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
          {/* Launch native macOS Terminal.app */}
          <button
            type="button"
            onClick={handleLaunchExternalTerminal}
            title="Launch native macOS Terminal.app in this workspace directory"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "4px",
              padding: "2px 7px",
              color: "var(--ink-secondary)",
              fontSize: "10.5px",
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              transition: "all 0.12s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--accent-teal)";
              e.currentTarget.style.borderColor = "var(--accent-teal)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--ink-secondary)";
              e.currentTarget.style.borderColor = "var(--border-subtle)";
            }}
          >
            <TerminalIcon size={11} />
            <span>Terminal.app ↗</span>
          </button>

          {/* Clear screen */}
          <button
            type="button"
            onClick={handleClear}
            title="Clear terminal output"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--ink-muted)",
              fontSize: "10.5px",
              cursor: "pointer",
              padding: "2px 4px",
              display: "flex",
              alignItems: "center",
              gap: "3px",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-muted)")}
          >
            <TrashIcon size={11} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Terminal Output Area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px",
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          lineHeight: 1.55,
          color: "var(--ink-secondary)",
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          wordBreak: "break-all",
          whiteSpace: "pre-wrap",
        }}
      >
        {lines.map((line) => {
          let color = "var(--ink-secondary)";
          let fontWeight: number | string = 400;

          if (line.type === "command") {
            color = "var(--accent-teal)";
            fontWeight = 600;
          } else if (line.type === "stderr") {
            color = "#F87171";
          } else if (line.type === "system") {
            color = "var(--ink-muted)";
          }

          return (
            <div key={line.id} style={{ color, fontWeight }}>
              {line.text}
            </div>
          );
        })}

        {isExecuting && (
          <div style={{ color: "var(--accent-teal)", display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                display: "inline-block",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "var(--accent-teal)",
                animation: "pulse 1s infinite alternate",
              }}
            />
            <span>Executing...</span>
          </div>
        )}

        <div ref={terminalEndRef} />
      </div>

      {/* Quick Action Chips */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          padding: "4px 10px",
          background: "var(--bg-canvas)",
          borderTop: "1px solid var(--border-subtle)",
          overflowX: "auto",
          flexShrink: 0,
        }}
      >
        {["git status", "ls -la", "pwd", "pnpm check", "node -v"].map((cmd) => (
          <button
            key={cmd}
            type="button"
            onClick={() => executeCommand(cmd)}
            style={{
              padding: "2px 6px",
              borderRadius: "3px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              color: "var(--ink-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.12s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--accent-teal)";
              e.currentTarget.style.borderColor = "var(--accent-teal)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--ink-muted)";
              e.currentTarget.style.borderColor = "var(--border-subtle)";
            }}
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Interactive Command Input Form */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          alignItems: "center",
          padding: "6px 10px",
          background: "var(--bg-input)",
          borderTop: "1px solid var(--border-medium)",
          gap: "6px",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11.5px",
            color: "var(--accent-teal)",
            fontWeight: 700,
            userSelect: "none",
          }}
        >
          ❯
        </span>
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Run shell command (e.g. ls, git status, pnpm, node)..."
          disabled={isExecuting}
          style={{
            flex: 1,
            height: "26px",
            background: "transparent",
            border: "none",
            color: "var(--ink-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={isExecuting || !inputVal.trim()}
          style={{
            height: "24px",
            padding: "0 8px",
            borderRadius: "4px",
            background: inputVal.trim() ? "var(--accent-teal-subtle)" : "transparent",
            border: inputVal.trim() ? "1px solid var(--accent-teal)" : "1px solid var(--border-subtle)",
            color: inputVal.trim() ? "var(--accent-teal)" : "var(--ink-muted)",
            fontSize: "10.5px",
            fontWeight: 600,
            cursor: inputVal.trim() ? "pointer" : "default",
          }}
        >
          Run
        </button>
      </form>
    </div>
  );
};
