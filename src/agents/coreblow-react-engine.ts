import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { getCognitiveCoordinator, type TrajectoryToolStep } from "./cognitive/coordinator.js";
import { getActiveMicrokernel } from "../gateway/microkernel-services.js";
import { loadConfig } from "../config/io.js";
import type { CoreBlowConfig } from "../config/config.js";

export type ExecutionProfile = "Full access" | "Workspace" | "Guarded" | "Read-only";

export interface CoreBlowToolResult {
  readonly success: boolean;
  readonly output: string;
  readonly exitCode?: number;
  readonly error?: string;
}

export interface ParsedToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: Record<string, unknown>;
  readonly rawBlock: string;
  readonly shortSummary?: string;
}

export interface ReActStep {
  readonly turn: number;
  readonly tool: string;
  readonly input: Record<string, unknown>;
  readonly output: string;
  readonly exitCode?: number;
  readonly success: boolean;
  readonly durationMs: number;
}

export interface CoreBlowReActOptions {
  prompt: string;
  messages?: Array<{ role: string; content: string }>;
  executionProfile?: ExecutionProfile;
  defaultCwd?: string;
  model?: string;
  providerUrl?: string;
  apiKey?: string;
  anthropicApiKey?: string;
  openAiApiKey?: string;
  geminiApiKey?: string;
  groqApiKey?: string;
  localOllamaUrl?: string;
  maxTurns?: number;
  runId?: string;
  sessionId?: string;
  trustZone?: string;
  userScope?: string;
  onProgressStep?: (stepDescription: string) => void;
  processRunner?: (
    command: string,
    args: string[],
    options: { cwd?: string; env?: Record<string, string>; timeout?: number },
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  fetchFn?: typeof fetch;
}

export interface CoreBlowReActResult {
  readonly ok: boolean;
  readonly reply: string;
  readonly toolSteps: string[];
  readonly steps: ReActStep[];
  readonly detectedPath?: string;
  readonly executionProfile: ExecutionProfile;
  readonly error?: string;
}

export interface DiscoveredEndpoint {
  readonly providerUrl: string;
  readonly model: string;
  readonly apiKey?: string;
  readonly source: string;
}

export const COREBLOW_OPENAI_TOOLS = [
  {
    type: "function",
    function: {
      name: "terminal",
      description: "Execute a shell command with timeout and safety profile guards",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "The shell command to execute" },
          cwd: { type: "string", description: "Optional working directory" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read file contents with 1-based line numbers and line limits",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the file to read" },
          offset: { type: "integer", description: "Starting line number (1-based)" },
          limit: { type: "integer", description: "Maximum number of lines to read" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write full text content to a file (requires Full access or Workspace profile)",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the file to write" },
          content: { type: "string", description: "The full text content to write" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "patch",
      description: "Replace target text in a file with new text (requires Full access or Workspace profile)",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the file to patch" },
          old_text: { type: "string", description: "Exact text to be replaced" },
          new_text: { type: "string", description: "Replacement text" },
        },
        required: ["path", "old_text", "new_text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description: "Search file names and file contents in a directory",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory to search" },
          pattern: { type: "string", description: "Text pattern or regex to search for" },
          max_matches: { type: "integer", description: "Maximum matches to return" },
        },
        required: ["pattern"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_dir",
      description: "List files and folders in a directory with file sizes",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path to list" },
          max_depth: { type: "integer", description: "Max recursion depth (default 2)" },
          max_entries: { type: "integer", description: "Max entries to return" },
        },
        required: ["path"],
      },
    },
  },
] as const;

export const COREBLOW_SYSTEM_PROMPT = `You are the CoreBlow Autonomous ReAct Agent operating inside the CoreBlow Sovereign Microkernel.
You have direct autonomous access to the local filesystem and terminal through 6 native CoreBlow tools:
- terminal: Execute shell commands (e.g. git, inspection commands, tests)
- read_file: Read file contents with 1-based line numbers
- write_file: Create or overwrite files
- patch: Replace exact text snippets in existing files
- search_files: Search file names and contents matching a pattern
- list_dir: List files and directory structures with file sizes

AUTONOMOUS EXECUTION RULES:
1. Always execute tools autonomously to investigate the filesystem, read files, or run tests before answering.
2. NEVER ask the user to manually run shell commands or paste terminal outputs.
3. If you need information from a file or folder, call the appropriate tool immediately.
4. When you have gathered all necessary information, provide a concise, high-confidence final response.
5. You may call tools using native function calls or <tool_call>{"name": "...", "arguments": {...}}</tool_call> tags.`;

/**
 * Builds an augmented PATH environment containing system and package manager binaries.
 */
export function getAugmentedEnvironment(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>;
  const home = env.HOME ?? os.homedir() ?? "";
  const existingPath = env.PATH ?? "";

  const additions = [
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    "/usr/local/bin",
    ...(home ? [`${home}/.local/share/pnpm`, `${home}/.bun/bin`, `${home}/.cargo/bin`] : []),
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
  ];

  const existingParts = new Set(existingPath.split(":").filter(Boolean));
  const merged = [
    ...additions.filter((p) => !existingParts.has(p)),
    ...existingPath.split(":").filter(Boolean),
  ].join(":");

  env.PATH = merged;
  return env;
}

/**
 * Normalizes shorthand paths like `user/<name>/...`, `~/...`, and relative paths.
 * Works seamlessly on macOS (/Users) and Linux VPS hosts (/home).
 */
export function normalizePath(rawPath: string, defaultCwd?: string): string {
  let p = rawPath.trim();
  if (!p) {
    return defaultCwd ?? process.env.HOME ?? os.homedir() ?? "/";
  }

  // user/<username>/... or users/<username>/...
  const userMatch = /^(?:user|users)\/([a-zA-Z0-9_\-.]+)(?:\/(.*))?$/i.exec(p);
  if (userMatch) {
    const user = userMatch[1];
    const rest = userMatch[2] ?? "";
    const isDarwin = process.platform === "darwin";
    let baseDir = isDarwin ? "/Users" : "/home";

    // Dynamic fallback if host has /Users on Linux or /home on macOS
    if (fs.existsSync(`/Users/${user}`)) {
      baseDir = "/Users";
    } else if (fs.existsSync(`/home/${user}`)) {
      baseDir = "/home";
    }

    p = rest ? `${baseDir}/${user}/${rest}` : `${baseDir}/${user}`;
  }

  // ~ or ~/
  const home = process.env.HOME ?? os.homedir() ?? "";
  if (p === "~") {
    p = home;
  } else if (p.startsWith("~/")) {
    p = home ? `${home}/${p.slice(2)}` : p.slice(1);
  }

  // Relative path against defaultCwd
  if (!p.startsWith("/") && defaultCwd && defaultCwd.length > 0) {
    p = path.join(defaultCwd, p);
  }

  p = path.normalize(p);

  // Clean trailing slashes if not root
  while (p.length > 1 && p.endsWith("/")) {
    p = p.slice(0, -1);
  }

  return p;
}

/**
 * Scans arbitrary prompt text for path references and returns the normalized path.
 */
export function detectAndNormalizePath(text: string): string | null {
  if (!text || !text.trim()) return null;

  // 1. user/febrinanda/foo or users/febrinanda/foo
  const userMatch = /\b(?:user|users)\/([a-zA-Z0-9_\-.]+)(?:\/([a-zA-Z0-9_\-./]+))?/i.exec(text);
  if (userMatch) {
    return normalizePath(userMatch[0]);
  }

  // 2. /Users/... or /home/... or /tmp/...
  const absMatch = /(\/(?:Users|home|var|tmp|private|opt|etc|srv)\/[a-zA-Z0-9_\-./]+)/.exec(text);
  if (absMatch?.[1]) {
    return normalizePath(absMatch[1]);
  }

  // 3. ~/foo
  const tildeMatch = /(~\/[a-zA-Z0-9_\-./]+)/.exec(text);
  if (tildeMatch?.[1]) {
    return normalizePath(tildeMatch[1]);
  }

  return null;
}

/**
 * Checks whether a path is contained within the active project directory.
 */
export function isPathInWorkspace(targetPath: string, defaultCwd?: string): boolean {
  if (!defaultCwd || !defaultCwd.trim()) return false;
  const normTarget = normalizePath(targetPath, defaultCwd);
  const normWorkspace = normalizePath(defaultCwd);
  return normTarget === normWorkspace || normTarget.startsWith(`${normWorkspace}/`);
}

/**
 * Validates whether a terminal command is allowed under the current execution profile.
 */
export function isCommandAllowed(
  command: string,
  executionProfile: ExecutionProfile,
  defaultCwd?: string,
  cwd?: string,
): boolean {
  const trimmed = command.trim();
  if (!trimmed) return false;

  // Catastrophic system-wipe checks across all profiles
  const catastrophicPatterns = [
    /rm\s+.*-(?:[a-zA-Z]*r[a-zA-Z]*f|[a-zA-Z]*f[a-zA-Z]*r)\b.*\s+\/(?:\s|$|\*)/,
    /rm\s+.*-[a-zA-Z]*r[a-zA-Z]*\s+.*-[a-zA-Z]*f[a-zA-Z]*.*\s+\/(?:\s|$|\*)/,
    /rm\s+.*-[a-zA-Z]*f[a-zA-Z]*\s+.*-[a-zA-Z]*r[a-zA-Z]*.*\s+\/(?:\s|$|\*)/,
    /mkfs(?:\.[a-zA-Z0-9]+)?\b/,
    /dd\s+if=\/dev\/zero\b/,
    /:\(\)\s*\{\s*:\|:&\s*\};:/,
    /chmod\s+(-[a-zA-Z]*R[a-zA-Z]*)\s+777\s+\//,
  ];

  for (const pattern of catastrophicPatterns) {
    if (pattern.test(trimmed)) {
      return false;
    }
  }

  if (executionProfile === "Full access") {
    return true;
  }

  if (executionProfile === "Workspace") {
    const effectiveDir = normalizePath(cwd ?? defaultCwd ?? "");
    if (isPathInWorkspace(effectiveDir, defaultCwd)) {
      return true;
    }
  }

  // In 'Guarded', 'Read-only', or 'Workspace' outside workspace: only allow safe inspection commands
  const allowedPrefixes = [
    "ls",
    "find",
    "cat",
    "head",
    "tail",
    "grep",
    "rg",
    "git status",
    "git log",
    "git diff",
    "git branch",
    "git show",
    "pwd",
    "stat",
    "wc",
    "tree",
    "file",
    "which",
    "echo",
    "du",
    "test",
    "uname",
  ];

  const subCommands = trimmed
    .split(/[|;&]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const sub of subCommands) {
    const subLower = sub.toLowerCase();
    const isAllowed = allowedPrefixes.some(
      (prefix) =>
        subLower === prefix ||
        subLower.startsWith(`${prefix} `) ||
        subLower.startsWith(`${prefix}\t`),
    );
    if (!isAllowed) {
      return false;
    }
  }

  return true;
}

/**
 * Formats byte sizes into human-readable strings.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Checks if a file path has a binary extension or exceeds 1MB.
 */
function isBinaryOrLargeFile(filePath: string): boolean {
  const binaryExts = new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".pdf",
    ".zip",
    ".tar",
    ".gz",
    ".dmg",
    ".iso",
    ".exe",
    ".so",
    ".dylib",
    ".dll",
    ".bin",
    ".wasm",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
  ]);
  const ext = path.extname(filePath).toLowerCase();
  if (binaryExts.has(ext)) return true;
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > 1024 * 1024) return true;
  } catch {
    return true;
  }
  return false;
}

/**
 * Server-Side CoreBlow Autonomous Tool Executor.
 */
export class CoreBlowToolExecutor {
  constructor(
    private readonly processRunner?: (
      command: string,
      args: string[],
      options: { cwd?: string; env?: Record<string, string>; timeout?: number },
    ) => Promise<{ stdout: string; stderr: string; exitCode: number }>,
    private readonly onFileModified?: (filePath: string) => void,
  ) {}

  private async defaultProcessRunner(
    executable: string,
    args: string[],
    options: { cwd?: string; env?: Record<string, string>; timeout?: number },
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const child = childProcess.spawn(executable, args, {
        cwd: options.cwd,
        env: options.env,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data: Buffer) => {
        stdout += data.toString("utf8");
      });
      child.stderr.on("data", (data: Buffer) => {
        stderr += data.toString("utf8");
      });

      const timeoutMs = options.timeout ?? 20000;
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`Command timed out after ${timeoutMs / 1000} seconds.`));
      }, timeoutMs);

      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });

      child.on("close", (exitCode) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, exitCode: exitCode ?? 0 });
      });
    });
  }

  /**
   * Dispatches a tool by name and arguments.
   */
  async executeTool(
    name: string,
    args: Record<string, unknown>,
    executionProfile: ExecutionProfile = "Full access",
    defaultCwd?: string,
  ): Promise<CoreBlowToolResult> {
    switch (name) {
      case "terminal":
        return this.executeTerminal(
          String(args.command ?? ""),
          args.cwd ? String(args.cwd) : undefined,
          executionProfile,
          defaultCwd,
        );
      case "read_file": {
        const offset = Number.parseInt(String(args.offset ?? "1"), 10) || 1;
        const limit = Number.parseInt(String(args.limit ?? "200"), 10) || 200;
        return this.readFile(String(args.path ?? ""), offset, limit, defaultCwd);
      }
      case "write_file":
        return this.writeFile(
          String(args.path ?? ""),
          String(args.content ?? ""),
          executionProfile,
          defaultCwd,
        );
      case "patch":
        return this.patchFile(
          String(args.path ?? ""),
          String(args.old_text ?? ""),
          String(args.new_text ?? ""),
          executionProfile,
          defaultCwd,
        );
      case "search_files": {
        const maxMatches = Number.parseInt(String(args.max_matches ?? "100"), 10) || 100;
        return this.searchFiles(
          args.path ? String(args.path) : undefined,
          String(args.pattern ?? ""),
          maxMatches,
          defaultCwd,
        );
      }
      case "list_dir": {
        const maxDepth = Number.parseInt(String(args.max_depth ?? "2"), 10) || 2;
        const maxEntries = Number.parseInt(String(args.max_entries ?? "150"), 10) || 150;
        return this.listDir(
          args.path ? String(args.path) : undefined,
          maxDepth,
          maxEntries,
          defaultCwd,
        );
      }
      default:
        return {
          success: false,
          output: `Unknown CoreBlow tool: ${name}. Available CoreBlow tools: terminal, read_file, write_file, patch, search_files, list_dir.`,
          error: `Unknown tool: ${name}`,
        };
    }
  }

  /**
   * 1. `terminal`: Executes a shell command with timeout and safety profile guards.
   */
  async executeTerminal(
    command: string,
    cwd?: string,
    executionProfile: ExecutionProfile = "Full access",
    defaultCwd?: string,
  ): Promise<CoreBlowToolResult> {
    const trimmed = command.trim();
    if (!trimmed) {
      return { success: false, output: "Empty command provided to terminal tool.", error: "Empty command" };
    }

    if (!isCommandAllowed(trimmed, executionProfile, defaultCwd, cwd)) {
      if (executionProfile === "Full access") {
        return {
          success: false,
          output: "Blocked for system safety: catastrophic command pattern detected.",
          error: "Catastrophic command",
        };
      }
      return {
        success: false,
        output: `Blocked by execution profile (${executionProfile}). Switch to 'Full access' or 'Workspace' to run modifying commands.`,
        error: "Permission denied",
      };
    }

    const targetDir = normalizePath(cwd ?? defaultCwd ?? process.env.HOME ?? "/");
    const effectiveDir = fs.existsSync(targetDir) ? targetDir : (process.env.HOME ?? "/");

    try {
      const runner = this.processRunner ?? this.defaultProcessRunner.bind(this);
      const isBashAvailable = fs.existsSync("/bin/bash") || fs.existsSync("/usr/bin/bash");
      const shellBin = isBashAvailable ? "bash" : "sh";

      const result = await runner(shellBin, ["-lc", trimmed], {
        cwd: effectiveDir,
        env: getAugmentedEnvironment(),
        timeout: 20000,
      });

      let stdout = result.stdout;
      if (stdout.length > 24 * 1024) {
        stdout = `${stdout.slice(0, 24 * 1024)}\n[... stdout truncated at 24KB ...]`;
      }

      let stderr = result.stderr;
      if (stderr.length > 8 * 1024) {
        stderr = `${stderr.slice(0, 8 * 1024)}\n[... stderr truncated at 8KB ...]`;
      }

      const lines: string[] = [`[exitCode: ${result.exitCode}]`];
      if (stdout.trim()) {
        lines.push("STDOUT:", stdout.trim());
      }
      if (stderr.trim()) {
        lines.push("STDERR:", stderr.trim());
      }
      if (!stdout.trim() && !stderr.trim()) {
        lines.push("(No output produced)");
      }

      const output = lines.join("\n");
      return {
        success: result.exitCode === 0,
        output,
        exitCode: result.exitCode,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Process execution error: ${msg}`, exitCode: -1, error: msg };
    }
  }

  /**
   * 2. `read_file`: Reads file lines with numbering (1-based) up to 32 KB.
   */
  async readFile(
    targetPath: string,
    offset = 1,
    limit = 200,
    defaultCwd?: string,
  ): Promise<CoreBlowToolResult> {
    const normPath = normalizePath(targetPath, defaultCwd);
    if (!fs.existsSync(normPath)) {
      return { success: false, output: `File not found: ${normPath}`, error: "File not found" };
    }

    try {
      const rawContent = await fsp.readFile(normPath, "utf8");
      const lines = rawContent.split("\n");
      const start = Math.max(1, offset);
      if (start > lines.length && lines.length > 0) {
        return {
          success: false,
          output: `Offset ${start} exceeds file line count (${lines.length}).`,
          error: "Offset out of bounds",
        };
      }

      const end = Math.min(start + Math.max(1, limit) - 1, lines.length);
      const header = `=== File: ${normPath} (lines ${start}-${end} of ${lines.length}) ===`;
      const numberedLines: string[] = [header];

      for (let i = start - 1; i < end; i++) {
        numberedLines.push(`${i + 1}: ${lines[i]}`);
      }

      let output = numberedLines.join("\n");
      if (output.length > 32 * 1024) {
        output = `${output.slice(0, 32 * 1024)}\n[... file output truncated at 32KB ...]`;
      }

      return { success: true, output };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Failed to read file ${normPath}: ${msg}`, error: msg };
    }
  }

  /**
   * 3. `write_file`: Writes full content, creates parents, checks profile.
   */
  async writeFile(
    targetPath: string,
    content: string,
    executionProfile: ExecutionProfile = "Full access",
    defaultCwd?: string,
  ): Promise<CoreBlowToolResult> {
    const normPath = normalizePath(targetPath, defaultCwd);

    if (executionProfile === "Full access") {
      // Allowed anywhere on host
    } else if (executionProfile === "Workspace") {
      if (!isPathInWorkspace(normPath, defaultCwd)) {
        return {
          success: false,
          output: `Blocked: write_file outside active workspace is not permitted under 'Workspace' profile (${normPath}).`,
          error: "Permission denied",
        };
      }
    } else {
      return {
        success: false,
        output: `Blocked: write_file requires 'Full access' or 'Workspace' profile. Current profile: ${executionProfile}.`,
        error: "Permission denied",
      };
    }

    try {
      const parentDir = path.dirname(normPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      await fsp.writeFile(normPath, content, "utf8");
      this.onFileModified?.(normPath);
      const lineCount = content.split("\n").length;
      return {
        success: true,
        output: `Successfully wrote ${content.length} bytes (${lineCount} lines) to ${normPath}.`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Failed to write file ${normPath}: ${msg}`, error: msg };
    }
  }

  /**
   * 4. `patch`: Replaces `old_text` with `new_text` in target file.
   */
  async patchFile(
    targetPath: string,
    oldText: string,
    newText: string,
    executionProfile: ExecutionProfile = "Full access",
    defaultCwd?: string,
  ): Promise<CoreBlowToolResult> {
    const normPath = normalizePath(targetPath, defaultCwd);

    if (executionProfile === "Full access") {
      // Allowed anywhere on host
    } else if (executionProfile === "Workspace") {
      if (!isPathInWorkspace(normPath, defaultCwd)) {
        return {
          success: false,
          output: `Blocked: patch outside active workspace is not permitted under 'Workspace' profile (${normPath}).`,
          error: "Permission denied",
        };
      }
    } else {
      return {
        success: false,
        output: `Blocked: patch requires 'Full access' or 'Workspace' profile. Current profile: ${executionProfile}.`,
        error: "Permission denied",
      };
    }

    if (!fs.existsSync(normPath)) {
      return { success: false, output: `File not found: ${normPath}`, error: "File not found" };
    }

    try {
      const content = await fsp.readFile(normPath, "utf8");
      if (!content.includes(oldText)) {
        return {
          success: false,
          output: `Target old_text not found in ${normPath}. Ensure exact whitespace and content match.`,
          error: "Target text not found",
        };
      }

      const updated = content.replace(oldText, newText);
      await fsp.writeFile(normPath, updated, "utf8");
      this.onFileModified?.(normPath);
      return { success: true, output: `Successfully patched ${normPath}.` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Failed to patch file ${normPath}: ${msg}`, error: msg };
    }
  }

  /**
   * 5. `search_files`: Searches filenames and line contents excluding build/deps folders.
   */
  async searchFiles(
    targetPath: string | undefined,
    pattern: string,
    maxMatches = 100,
    defaultCwd?: string,
  ): Promise<CoreBlowToolResult> {
    const normPath = normalizePath(targetPath ?? "", defaultCwd);
    if (!fs.existsSync(normPath)) {
      return { success: false, output: `Directory not found: ${normPath}`, error: "Directory not found" };
    }
    if (!pattern.trim()) {
      return { success: false, output: "Empty search pattern provided.", error: "Empty pattern" };
    }

    const ignoredDirs = new Set([
      ".git",
      "node_modules",
      "build",
      ".dart_tool",
      "dist",
      "Pods",
      ".next",
      ".cache",
      ".wrangler",
      ".gradle",
      ".idea",
      ".vscode",
    ]);

    const results: string[] = [];
    let regex: RegExp | null = null;
    try {
      regex = new RegExp(pattern, "i");
    } catch {
      // Fallback to literal case-insensitive matching
    }

    const walk = (dir: string) => {
      if (results.length >= maxMatches) return;
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (results.length >= maxMatches) break;
        if (ignoredDirs.has(entry.name)) continue;

        const fullPath = path.join(dir, entry.name);
        const isNameMatch = regex ? regex.test(entry.name) : entry.name.toLowerCase().includes(pattern.toLowerCase());
        if (isNameMatch) {
          results.push(`[FILE MATCH] ${fullPath}`);
        }

        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile() && !isBinaryOrLargeFile(fullPath)) {
          try {
            const content = fs.readFileSync(fullPath, "utf8");
            const lines = content.split("\n");
            for (let lIdx = 0; lIdx < lines.length; lIdx++) {
              if (results.length >= maxMatches) break;
              const line = lines[lIdx];
              const isLineMatch = regex ? regex.test(line) : line.toLowerCase().includes(pattern.toLowerCase());
              if (isLineMatch) {
                const preview = line.trim();
                const shortPreview = preview.length > 120 ? `${preview.slice(0, 120)}...` : preview;
                results.push(`${fullPath}:${lIdx + 1}: ${shortPreview}`);
              }
            }
          } catch {
            // Ignore unreadable files
          }
        }
      }
    };

    try {
      walk(normPath);
      if (results.length === 0) {
        return { success: true, output: `No matches found for pattern "${pattern}" in ${normPath}.` };
      }

      const output = [
        `Found ${results.length} matches in ${normPath} for "${pattern}":`,
        ...results,
      ].join("\n");
      return { success: true, output };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, output: `Error during search: ${msg}`, error: msg };
    }
  }

  /**
   * 6. `list_dir`: Lists files and subdirectories with sizes up to `max_depth`.
   */
  async listDir(
    targetPath: string | undefined,
    maxDepth = 2,
    maxEntries = 150,
    defaultCwd?: string,
  ): Promise<CoreBlowToolResult> {
    const normPath = normalizePath(targetPath ?? "", defaultCwd);
    if (!fs.existsSync(normPath)) {
      return { success: false, output: `Directory not found: ${normPath}`, error: "Directory not found" };
    }

    const ignoredDirs = new Set([
      ".git",
      "node_modules",
      "build",
      ".dart_tool",
      "dist",
      "Pods",
      ".next",
      ".cache",
      ".wrangler",
      ".gradle",
    ]);

    const boundedDepth = Math.max(1, Math.min(4, maxDepth));
    interface DirEntry {
      readonly path: string;
      readonly isDir: boolean;
      readonly size: number;
    }
    const entries: DirEntry[] = [];

    const walk = (current: string, currentDepth: number) => {
      if (currentDepth > boundedDepth || entries.length >= maxEntries) return;

      let items: fs.Dirent[] = [];
      try {
        items = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        return;
      }

      for (const item of items) {
        if (entries.length >= maxEntries) break;
        if (ignoredDirs.has(item.name)) continue;

        const fullPath = path.join(current, item.name);
        let rel = fullPath;
        if (rel.startsWith(normPath)) {
          rel = rel.slice(normPath.length);
          if (rel.startsWith("/")) rel = rel.slice(1);
        }

        if (item.isDirectory()) {
          entries.push({ path: `${rel}/`, isDir: true, size: 0 });
          walk(fullPath, currentDepth + 1);
        } else if (item.isFile()) {
          let size = 0;
          try {
            size = fs.statSync(fullPath).size;
          } catch {
            // size remains 0
          }
          entries.push({ path: rel, isDir: false, size });
        }
      }
    };

    walk(normPath, 1);

    entries.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.path.localeCompare(b.path);
    });

    const lines: string[] = [`=== Directory Listing: ${normPath} (${entries.length} items) ===`];
    for (const e of entries) {
      if (e.isDir) {
        lines.push(`[DIR]  ${e.path}`);
      } else {
        lines.push(`[FILE] ${e.path} (${formatBytes(e.size)})`);
      }
    }

    if (entries.length >= maxEntries) {
      lines.push(`[... truncated at ${maxEntries} entries ...]`);
    }

    return { success: true, output: lines.join("\n") };
  }
}

/**
 * Parses XML `<tool_call>...</tool_call>` blocks.
 */
export function parseXmlToolCalls(text: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];
  const regex = /<tool_call>([\s\S]*?)<\/tool_call>/gi;
  let match: RegExpExecArray | null = null;

  while ((match = regex.exec(text)) !== null) {
    const rawContent = match[1]?.trim();
    if (!rawContent) continue;

    try {
      const decoded = JSON.parse(rawContent) as Record<string, unknown>;
      const name = String(decoded.name ?? "").trim();
      let args: Record<string, unknown> = {};
      if (typeof decoded.arguments === "object" && decoded.arguments !== null) {
        args = decoded.arguments as Record<string, unknown>;
      } else if (typeof decoded.arguments === "string") {
        try {
          args = JSON.parse(decoded.arguments) as Record<string, unknown>;
        } catch {
          // ignore
        }
      }

      if (name) {
        calls.push({
          id: `coreblow_${Date.now()}_${calls.length}`,
          name,
          arguments: args,
          rawBlock: match[0],
          shortSummary: formatShortSummary(name, args),
        });
      }
    } catch {
      const nameMatch = /"name"\s*:\s*"([^"]+)"/.exec(rawContent);
      if (nameMatch?.[1]) {
        calls.push({
          id: `coreblow_${Date.now()}_${calls.length}`,
          name: nameMatch[1],
          arguments: {},
          rawBlock: match[0],
          shortSummary: nameMatch[1],
        });
      }
    }
  }

  return calls;
}

/**
 * Self-Healing Bash Interceptor:
 * Detects if the model claims it cannot read the filesystem or asks the user to paste output
 * while outputting bash/sh commands in markdown code blocks.
 */
export function detectBashCommandsToIntercept(text: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];
  const lower = text.toLowerCase();
  const hasDenialOrInstruction =
    lower.includes("gak bisa baca") ||
    lower.includes("tidak bisa baca") ||
    lower.includes("can't read") ||
    lower.includes("cannot read") ||
    lower.includes("no filesystem") ||
    lower.includes("no web access") ||
    lower.includes("paste output") ||
    lower.includes("paste hasil") ||
    lower.includes("bisa run") ||
    lower.includes("run command") ||
    lower.includes("jalankan perintah") ||
    lower.includes("execute the following");

  if (hasDenialOrInstruction) {
    const codeBlockRegex = /```(?:bash|sh)?\r?\n([\s\S]*?)\r?\n```/g;
    let blockMatch: RegExpExecArray | null = null;
    while ((blockMatch = codeBlockRegex.exec(text)) !== null) {
      const block = blockMatch[1]?.trim();
      if (!block) continue;

      const lines = block
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"));

      for (const line of lines) {
        if (
          line.startsWith("find ") ||
          line.startsWith("ls ") ||
          line.startsWith("ls\t") ||
          line === "ls" ||
          line.startsWith("cat ") ||
          line.startsWith("head ") ||
          line.startsWith("tail ") ||
          line.startsWith("grep ") ||
          line.startsWith("tree ") ||
          line.startsWith("git ")
        ) {
          calls.push({
            id: `intercept_${Date.now()}_${calls.length}`,
            name: "terminal",
            arguments: { command: line },
            rawBlock: blockMatch[0],
            shortSummary: line.length > 40 ? `${line.slice(0, 40)}...` : line,
          });
        }
      }
    }
  }

  return calls;
}

/**
 * Formats a short summary label for a tool call.
 */
function formatShortSummary(name: string, args: Record<string, unknown>): string {
  if (name === "terminal") {
    const cmd = String(args.command ?? "");
    return cmd.length > 40 ? `${cmd.slice(0, 40)}...` : cmd;
  }
  if (name === "list_dir" || name === "read_file" || name === "write_file" || name === "patch") {
    const p = String(args.path ?? "");
    const parts = p.split("/").filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : p;
  }
  if (name === "search_files") {
    return String(args.pattern ?? "");
  }
  return JSON.stringify(args);
}

/**
 * Strips raw `<tool_call>` and `<tool_response>` tags from text.
 */
export function cleanToolBlocksFromText(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(/<tool_call>[\s\S]*?(?:<\/tool_call>|$)/gi, "");
  cleaned = cleaned.replace(/<tool_response>[\s\S]*?(?:<\/tool_response>|$)/gi, "");
  return cleaned.trim();
}

/**
 * Pre-fetches directory listing and root manifest previews to provide a proactive workspace snapshot.
 */
export async function generateWorkspaceSnapshot(dirPath: string): Promise<string> {
  const normPath = normalizePath(dirPath);
  if (!fs.existsSync(normPath)) return "";

  const executor = new CoreBlowToolExecutor();
  const listingResult = await executor.listDir(normPath, 2, 40);

  const manifestFiles = ["package.json", "README.md", "pyproject.toml", "Cargo.toml", "pubspec.yaml"];
  const manifestPreviews: string[] = [];

  for (const file of manifestFiles) {
    const candidatePath = path.join(normPath, file);
    if (fs.existsSync(candidatePath)) {
      const readResult = await executor.readFile(candidatePath, 1, 35);
      if (readResult.success) {
        manifestPreviews.push(readResult.output);
      }
    }
  }

  const sections: string[] = [
    `[CoreBlow Proactive Workspace Snapshot for ${normPath}]`,
    listingResult.output,
  ];

  if (manifestPreviews.length > 0) {
    sections.push("\n[Key Project Manifest Previews]", ...manifestPreviews);
  }

  return sections.join("\n\n");
}

export interface AutoDiscoverEndpointOptions {
  fetchFn?: typeof fetch;
  anthropicApiKey?: string;
  openAiApiKey?: string;
  geminiApiKey?: string;
  groqApiKey?: string;
  localOllamaUrl?: string;
  apiKey?: string;
}

function extractApiKeyString(key: unknown): string | undefined {
  if (typeof key === "string" && key.trim().length > 0) {
    return key.trim();
  }
  return undefined;
}

/**
 * Probes environment variables and local sockets to auto-discover active model runtimes.
 * Upstream discovery: never resolves to 127.0.0.1:18789 (which is the CoreBlow Gateway itself).
 */
export async function autoDiscoverRuntimeEndpoints(
  optionsOrFetch: typeof fetch | AutoDiscoverEndpointOptions = fetch,
): Promise<DiscoveredEndpoint | null> {
  const fetchFn = typeof optionsOrFetch === "function" ? optionsOrFetch : (optionsOrFetch?.fetchFn ?? fetch);
  const opts = typeof optionsOrFetch === "object" ? optionsOrFetch : {};

  // 1. Check active provider/API keys: passed in options, configured in CoreBlow config, or in process.env
  let cfg: CoreBlowConfig | undefined;
  try {
    cfg = loadConfig();
  } catch {
    // ignore
  }

  const anthropicKey =
    opts.anthropicApiKey ||
    process.env.ANTHROPIC_API_KEY ||
    extractApiKeyString(cfg?.models?.providers?.anthropic?.apiKey);
  if (anthropicKey) {
    return {
      providerUrl: "https://api.anthropic.com/v1",
      model: "claude-3-7-sonnet-20250219",
      apiKey: anthropicKey,
      source: opts.anthropicApiKey ? "Studio Settings (Anthropic)" : "Environment (ANTHROPIC_API_KEY)",
    };
  }

  const openAiKey =
    opts.openAiApiKey ||
    process.env.OPENAI_API_KEY ||
    extractApiKeyString(cfg?.models?.providers?.openai?.apiKey);
  if (openAiKey) {
    return {
      providerUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
      apiKey: openAiKey,
      source: opts.openAiApiKey ? "Studio Settings (OpenAI)" : "Environment (OPENAI_API_KEY)",
    };
  }

  const geminiKey =
    opts.geminiApiKey ||
    process.env.GEMINI_API_KEY ||
    extractApiKeyString(cfg?.models?.providers?.google?.apiKey) ||
    extractApiKeyString(cfg?.models?.providers?.gemini?.apiKey);
  if (geminiKey) {
    return {
      providerUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      model: "gemini-2.0-flash",
      apiKey: geminiKey,
      source: opts.geminiApiKey ? "Studio Settings (Gemini)" : "Environment (GEMINI_API_KEY)",
    };
  }

  const groqKey =
    opts.groqApiKey ||
    process.env.GROQ_API_KEY ||
    extractApiKeyString(cfg?.models?.providers?.groq?.apiKey);
  if (groqKey) {
    return {
      providerUrl: "https://api.groq.com/openai/v1",
      model: "llama-3.3-70b-versatile",
      apiKey: groqKey,
      source: opts.groqApiKey ? "Studio Settings (Groq)" : "Environment (GROQ_API_KEY)",
    };
  }

  // 2. Check local upstream OpenAI-compatible proxy (127.0.0.1:20128)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 800);
    const proxyKey = opts.apiKey || (process.env.COREBLOW_PROXY_API_KEY ?? "");
    const res = await fetchFn("http://127.0.0.1:20128/v1/models", {
      headers: {
        Authorization: `Bearer ${proxyKey}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as { data?: Array<{ id: string }> };
      const model = data.data?.[0]?.id ?? "coreblow-agent";
      return {
        providerUrl: "http://127.0.0.1:20128/v1",
        model,
        apiKey: proxyKey,
        source: "Local Proxy (127.0.0.1:20128)",
      };
    }
  } catch {
    // ignore
  }

  // 3. Check local Ollama (127.0.0.1:11434)
  const ollamaBase = (opts.localOllamaUrl || "http://127.0.0.1:11434").replace(/\/+$/, "");
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 800);
    const res = await fetchFn(`${ollamaBase}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as { models?: Array<{ name: string }> };
      const model = data.models?.[0]?.name ?? "llama3.2";
      return {
        providerUrl: `${ollamaBase}/v1`,
        model,
        source: `Local Ollama (${ollamaBase})`,
      };
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Runs the CoreBlow Autonomous ReAct tool execution loop.
 */
export async function runCoreBlowReActLoop(options: CoreBlowReActOptions): Promise<CoreBlowReActResult> {
  const fetchFn = options.fetchFn ?? fetch;
  const executionProfile = options.executionProfile ?? "Full access";
  const defaultCwd = options.defaultCwd ? normalizePath(options.defaultCwd) : process.cwd();
  const maxTurns = options.maxTurns ?? 8;

  // 1. Path detection and proactive snapshot
  const detectedPath = detectAndNormalizePath(options.prompt);
  let effectiveCwd = defaultCwd;
  if (detectedPath && fs.existsSync(detectedPath)) {
    try {
      const stat = fs.statSync(detectedPath);
      effectiveCwd = stat.isDirectory() ? detectedPath : path.dirname(detectedPath);
    } catch {
      // ignore
    }
  }

  let snapshotContext = "";
  if (fs.existsSync(effectiveCwd)) {
    try {
      snapshotContext = await generateWorkspaceSnapshot(effectiveCwd);
    } catch {
      // ignore
    }
  }

  // 1b. Single-Brain CognitiveCoordinator integration (Phase B1 / B1.5)
  const runId = options.runId ?? `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const sessionId = options.sessionId ?? `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const coordinator = getCognitiveCoordinator();

  let cognitiveContext:
    | Awaited<ReturnType<typeof coordinator.onContextAssembly>>
    | undefined;

  try {
    await coordinator.onTurnStart({
      runId,
      sessionId,
      prompt: options.prompt,
      requestedProvider: "custom",
      requestedModel: options.model ?? "coreblow-agent",
      workspaceDir: effectiveCwd,
      trustZone: options.trustZone,
    });

    cognitiveContext = await coordinator.onContextAssembly({
      prompt: options.prompt,
      workspaceDir: effectiveCwd,
      userScope: options.userScope,
      trustZone: options.trustZone,
    });

    const preLlmCheck = coordinator.preLlmCall({
      prompt: options.prompt,
      trustZone: options.trustZone,
      activeConstraints: cognitiveContext?.activeConstraints,
    });

    if (!preLlmCheck.allowed) {
      const blockedMsg = `SECURITY_GATE_BLOCKED: ${preLlmCheck.blockedReason ?? "Prompt rejected by security gate"}`;
      return {
        ok: false,
        reply: blockedMsg,
        toolSteps: [],
        steps: [],
        detectedPath: detectedPath ?? undefined,
        executionProfile,
        error: blockedMsg,
      };
    }
  } catch (err: unknown) {
    if (String(err).includes("SECURITY_GATE_BLOCKED")) {
      throw err;
    }
    // Fail-open for turn start errors in non-critical paths
  }

  // 2. Discover endpoint if not explicitly provided or if self-loop detected
  let providerUrl = options.providerUrl;
  let model = options.model;
  let apiKey = options.apiKey;

  const isSelfLoop = Boolean(
    providerUrl && (providerUrl.includes("127.0.0.1:18789") || providerUrl.includes("localhost:18789")),
  );

  if (!providerUrl || isSelfLoop) {
    const discovered = await autoDiscoverRuntimeEndpoints({
      fetchFn,
      anthropicApiKey: options.anthropicApiKey,
      openAiApiKey: options.openAiApiKey,
      geminiApiKey: options.geminiApiKey,
      groqApiKey: options.groqApiKey,
      localOllamaUrl: options.localOllamaUrl,
      apiKey: !isSelfLoop ? options.apiKey : undefined,
    });
    if (discovered) {
      providerUrl = discovered.providerUrl;
      model = (!model || model === "coding" || model === "deep") ? discovered.model : model;
      apiKey = apiKey ?? discovered.apiKey;
    } else {
      // Upstream fallback: use local proxy, NEVER gateway port 18789
      providerUrl = "http://127.0.0.1:20128/v1";
      model = (!model || model === "coding" || model === "deep" || model === "coreblow-agent") ? "supergratis" : model;
      apiKey = apiKey ?? (process.env.COREBLOW_PROXY_API_KEY ?? "");
    }
  }

  if (providerUrl.includes(":20128")) {
    if (!model || model === "coding" || model === "deep" || model === "coreblow-agent") {
      model = "supergratis";
    }
    if (!apiKey) {
      apiKey = process.env.COREBLOW_PROXY_API_KEY ?? "";
    }
  }

  // Pre-persist explicit memory directives so facts survive even on interrupted turns
  const activeMk = getActiveMicrokernel();
  if (activeMk?.cory?.memoryStore) {
    const lowerPrompt = options.prompt.toLowerCase();
    if (lowerPrompt.startsWith("remember:") || lowerPrompt.startsWith("ingat:")) {
      const toRemember = options.prompt.replace(/^(remember|ingat):\s*/i, "").trim();
      if (toRemember) {
        activeMk.cory.memoryStore.remember({
          layer: "durable",
          content: toRemember,
          scope: { workspaceId: "default", userScope: options.userScope },
        });
      }
    }
  }

  const endpoint = `${providerUrl.replace(/\/+$/, "")}/chat/completions`;
  const executor = new CoreBlowToolExecutor(options.processRunner);

  const systemMessageParts = [
    COREBLOW_SYSTEM_PROMPT,
    `Active Working Directory: ${effectiveCwd}`,
    `Execution Profile: ${executionProfile}`,
    ...(snapshotContext ? [snapshotContext] : []),
  ];

  if (cognitiveContext?.memoryBlock) {
    systemMessageParts.push(cognitiveContext.memoryBlock);
  }
  if (cognitiveContext?.skillsBlock) {
    systemMessageParts.push(cognitiveContext.skillsBlock);
  }

  const systemMessage = systemMessageParts.join("\n\n");

  const conversation: Array<Record<string, unknown>> = [
    { role: "system", content: systemMessage },
    ...(options.messages ?? []),
    { role: "user", content: options.prompt },
  ];

  const toolSteps: string[] = [];
  const steps: ReActStep[] = [];
  let finalReply = "";

  for (let turn = 1; turn <= maxTurns; turn++) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const payload = {
      model,
      messages: conversation,
      tools: COREBLOW_OPENAI_TOOLS,
      tool_choice: "auto",
      stream: false,
    };

    let response: Response;
    try {
      response = await fetchFn(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        reply: `Network connection error contacting LLM provider at ${endpoint}: ${msg}`,
        toolSteps,
        steps,
        detectedPath: detectedPath ?? undefined,
        executionProfile,
        error: msg,
      };
    }

    if (!response.ok) {
      const errText = await response.text();
      return {
        ok: false,
        reply: `LLM Provider returned error ${response.status}: ${errText}`,
        toolSteps,
        steps,
        detectedPath: detectedPath ?? undefined,
        executionProfile,
        error: `HTTP ${response.status}`,
      };
    }

    const rawText = await response.text();
    let content = "";
    const nativeToolCalls: Array<{
      id: string;
      function: { name: string; arguments: string };
    }> = [];

    if (rawText.trim().startsWith("data:")) {
      // Upstream streamed SSE response
      const lines = rawText.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data:") && !trimmed.includes("[DONE]")) {
          try {
            const chunk = JSON.parse(trimmed.slice(5).trim());
            const delta = chunk.choices?.[0]?.delta;
            if (delta?.content) {
              content += delta.content;
            }
            if (delta?.tool_calls) {
              nativeToolCalls.push(...delta.tool_calls);
            }
          } catch {}
        }
      }
    } else {
      try {
        const json = JSON.parse(rawText) as {
          choices?: Array<{
            message?: {
              role?: string;
              content?: string;
              tool_calls?: Array<{
                id: string;
                function: { name: string; arguments: string };
              }>;
            };
          }>;
        };
        const choice = json.choices?.[0]?.message;
        content = choice?.content ?? "";
        if (choice?.tool_calls) {
          nativeToolCalls.push(...choice.tool_calls);
        }
      } catch {
        content = rawText;
      }
    }

    // Parse tool calls across all protocols
    const callsToExecute: ParsedToolCall[] = [];

    // 1. Native OpenAI tool calls
    for (const tc of nativeToolCalls) {
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(tc.function.arguments) as Record<string, unknown>;
      } catch {
        // ignore
      }
      callsToExecute.push({
        id: tc.id,
        name: tc.function.name,
        arguments: parsedArgs,
        rawBlock: JSON.stringify(tc),
        shortSummary: formatShortSummary(tc.function.name, parsedArgs),
      });
    }

    // 2. XML <tool_call> tags
    if (callsToExecute.length === 0 && content) {
      callsToExecute.push(...parseXmlToolCalls(content));
    }

    // 3. Self-healing bash interceptor
    if (callsToExecute.length === 0 && content) {
      callsToExecute.push(...detectBashCommandsToIntercept(content));
    }

    // If no tool calls were requested, we reached the final answer!
    if (callsToExecute.length === 0) {
      finalReply = cleanToolBlocksFromText(content);
      break;
    }

    // Execute each tool call
    for (const call of callsToExecute) {
      const startMs = Date.now();
      const stepDesc = `Executing ${call.name} (${call.shortSummary ?? ""})`;
      options.onProgressStep?.(stepDesc);

      const result = await executor.executeTool(
        call.name,
        call.arguments,
        executionProfile,
        effectiveCwd,
      );

      const durationMs = Date.now() - startMs;
      const statusIcon = result.success ? "✓" : "✗";
      const summary = `${statusIcon} ${call.name} · ${call.shortSummary ?? ""} (${durationMs}ms)`;
      toolSteps.push(summary);

      steps.push({
        turn,
        tool: call.name,
        input: call.arguments,
        output: result.output,
        exitCode: result.exitCode,
        success: result.success,
        durationMs,
      });

      // Append assistant message and tool response to conversation
      conversation.push({
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: call.id,
            type: "function",
            function: {
              name: call.name,
              arguments: JSON.stringify(call.arguments),
            },
          },
        ],
      });

      conversation.push({
        role: "tool",
        tool_call_id: call.id,
        content: result.output,
      });
    }
  }

  const ok = Boolean(finalReply) || steps.length > 0;
  if (!finalReply && steps.length > 0) {
    const lastStep = steps[steps.length - 1];
    finalReply = `CoreBlow Autonomous Engine completed ${steps.length} step(s).\n\n${lastStep.output}`;
  }

  // 4. Cognitive turn end notification & trajectory ingestion
  try {
    const trajectorySteps: TrajectoryToolStep[] = steps.map((s) => ({
      toolName: s.tool,
      argsSummary: formatShortSummary(s.tool, s.input),
      succeeded: s.success,
      outputSummary: s.output ? s.output.slice(0, 200) : undefined,
      durationMs: s.durationMs,
      input: s.input,
      output: s.output,
    }));

    await coordinator.onTurnEnd({
      runId,
      sessionId,
      userGoal: options.prompt,
      steps: trajectorySteps,
      finalOutcome: ok ? "success" : "failure",
      trustZone: options.trustZone,
      workspaceId: effectiveCwd,
      userScope: options.userScope,
      skillsInvoked: cognitiveContext?.matchedSkills?.map((s) => s.id),
    });

    // Also persist explicit user preferences if detected or durable instructions
    const microkernel = getActiveMicrokernel();
    if (microkernel?.cory?.memoryStore) {
      const lowerPrompt = options.prompt.toLowerCase();
      if (lowerPrompt.startsWith("remember:") || lowerPrompt.startsWith("ingat:")) {
        const toRemember = options.prompt.replace(/^(remember|ingat):\s*/i, "").trim();
        if (toRemember) {
          microkernel.cory.memoryStore.remember({
            layer: "durable",
            content: toRemember,
            scope: { workspaceId: effectiveCwd, userScope: options.userScope },
          });
        }
      }
    }
  } catch {
    // Best-effort turn recording
  }

  return {
    ok,
    reply: finalReply,
    toolSteps,
    steps,
    detectedPath: detectedPath ?? undefined,
    executionProfile,
  };
}
