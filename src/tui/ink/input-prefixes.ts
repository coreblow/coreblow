import { exec } from "node:child_process";
import process from "node:process";
import { inkPalette } from "./theme.js";

export type PermissionMode = "manual" | "acceptEdits" | "plan" | "auto";

export interface SlashCommandMatch {
  cmd: string;
  desc: string;
  isSkill?: boolean;
}

export const BUILTIN_SLASH_COMMANDS: SlashCommandMatch[] = [
  { cmd: "/help", desc: "Show slash commands" },
  { cmd: "/model", desc: "Open model switcher" },
  { cmd: "/chat", desc: "Start a fresh chat turn" },
  { cmd: "/agent", desc: "Show War Room squad specialist roles" },
  { cmd: "/tool", desc: "Show active autonomous toolsets summary" },
  { cmd: "/setup", desc: "Run setup wizard" },
  { cmd: "/sessions", desc: "List recent sessions" },
  { cmd: "/pool", desc: "Manage credential pool and failover" },
  { cmd: "/memory", desc: "Review Cory dialectic memory and proposals" },
  { cmd: "/sandbox", desc: "Configure OS-level shell sandbox" },
  { cmd: "/mode", desc: "Switch between basic and pro UI mode" },
  { cmd: "/rewind", desc: "Open checkpoint rewind modal" },
  { cmd: "/rollback", desc: "Undo last file edit checkpoint" },
  { cmd: "/diff", desc: "View current session file changes" },
  { cmd: "/clear", desc: "Clear current session" },
  { cmd: "/compact", desc: "Compact conversation history" },
  { cmd: "/context", desc: "Inspect current context window usage" },
  { cmd: "/usage", desc: "View token usage and cost summary" },
  { cmd: "/desktop", desc: "Launch CoreBlow Studio desktop" },
  { cmd: "/exit", desc: "Exit CoreBlow TUI" },
];

const PERMISSION_MODES: readonly PermissionMode[] = ["manual", "acceptEdits", "plan", "auto"];

/**
 * Filter slash commands and skills based on user typing.
 */
export function filterSlashCommands(
  query: string,
  availableSkills: string[] = [],
): SlashCommandMatch[] {
  const q = query.trim().toLowerCase();
  const all: SlashCommandMatch[] = [...BUILTIN_SLASH_COMMANDS];

  for (const skill of availableSkills) {
    all.push({
      cmd: `/${skill}`,
      desc: `Skill: ${skill}`,
      isSkill: true,
    });
  }

  if (!q || q === "/") {
    return all;
  }

  return all.filter((c) => c.cmd.toLowerCase().includes(q));
}

/**
 * Returns tab completion target for the top match.
 */
export function resolveTabCompletion(input: string, matches: SlashCommandMatch[]): string {
  if (matches.length > 0 && matches[0]) {
    return `${matches[0].cmd} `;
  }
  return input;
}

/**
 * Checks if line is a `!` local shell escape command.
 */
export function parseShellEscape(line: string): { isShell: boolean; command: string } {
  const trimmed = line.trim();
  if (trimmed.startsWith("!") && trimmed.length > 1) {
    return {
      isShell: true,
      command: trimmed.slice(1).trim(),
    };
  }
  return {
    isShell: false,
    command: "",
  };
}

const DANGEROUS_PATTERNS = [
  /\brm\s+-[a-z]*[rf][a-z]*\s+(\/|--no-preserve-root)(\s|$)/i,
  /\bmkfs(\.[a-z0-9]+)?\b/i,
  /\bdd\s+if=.*of=\/dev\b/i,
  /:(){ :|:& };:/,
  />\s*\/dev\/[s|h]d[a-z]/i,
];

/**
 * Checks if local shell command contains catastrophic patterns.
 */
export function isDangerousShellCommand(command: string): { dangerous: boolean; reason?: string } {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return {
        dangerous: true,
        reason: `Command blocked by CoreBlow safety guard: ${command}`,
      };
    }
  }
  return { dangerous: false };
}

/**
 * Executes a local shell command directly in cwd with zero LLM tokens.
 */
export function executeLocalShell(
  command: string,
  cwd: string = process.cwd(),
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    exec(command, { cwd, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout || "",
        stderr: stderr || "",
        exitCode: error && typeof error.code === "number" ? error.code : error ? 1 : 0,
      });
    });
  });
}

/**
 * Collapses large multi-line or long pastes into a compact chip [Pasted #N +M lines].
 */
export function collapsePastedText(
  text: string,
  existingChipsCount = 0,
): { displayText: string; fullContent: string; isChip: boolean; chipLabel?: string } {
  const lines = text.split("\n");
  const isLarge = lines.length > 3 || text.length > 800;

  if (!isLarge) {
    return {
      displayText: text,
      fullContent: text,
      isChip: false,
    };
  }

  const chipLabel = `[Pasted #${existingChipsCount + 1} +${lines.length} lines]`;
  return {
    displayText: chipLabel,
    fullContent: text,
    isChip: true,
    chipLabel,
  };
}

/**
 * Replaces any paste chips in text with their stored original full content.
 */
export function expandPastedChips(text: string, chips: Map<string, string>): string {
  let result = text;
  for (const [chip, content] of chips.entries()) {
    result = result.split(chip).join(content);
  }
  return result;
}

/**
 * Cycles permission mode in order: manual -> acceptEdits -> plan -> auto.
 */
export function cyclePermissionMode(current: PermissionMode): PermissionMode {
  const idx = PERMISSION_MODES.indexOf(current);
  const nextIdx = (idx + 1) % PERMISSION_MODES.length;
  return PERMISSION_MODES[nextIdx]!;
}

/**
 * Gets color and label for permission mode badge.
 */
export function getPermissionModeBadge(mode: PermissionMode): { label: string; color: string } {
  switch (mode) {
    case "manual":
      return { label: "manual", color: inkPalette.accent };
    case "acceptEdits":
      return { label: "acceptEdits", color: inkPalette.link };
    case "plan":
      return { label: "plan", color: inkPalette.accentSoft };
    case "auto":
      return { label: "auto", color: inkPalette.success };
  }
}

/**
 * In-memory Draft Stash stack for Ctrl+S.
 */
export class DraftStashStack {
  private stack: string[] = [];

  push(draft: string): number {
    const trimmed = draft.trim();
    if (trimmed) {
      this.stack.push(trimmed);
    }
    return this.stack.length;
  }

  pop(): string | undefined {
    return this.stack.pop();
  }

  count(): number {
    return this.stack.length;
  }

  clear(): void {
    this.stack = [];
  }
}
