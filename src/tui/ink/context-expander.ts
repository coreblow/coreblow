import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execSync } from "node:child_process";
import os from "node:os";

export interface ContextExpansionResult {
  expanded: string;
  warnings: string[];
  refused?: string;
}

const DEFAULT_CONTEXT_WINDOW_CHARS = 128_000 * 4; // ~128k tokens in characters (~512,000 chars)

const SENSITIVE_PATTERNS = [
  /^\.env(\..+)?$/i,
  /\.env(\..+)?$/i,
  /\/\.env(\..+)?$/i,
  /\.pem$/i,
  /\.key$/i,
  /^id_rsa/i,
  /\.ssh\//i,
  /\.aws\//i,
  /\.coreblow\/\.env/i,
];

/**
 * Checks if a path is considered a sensitive secret that must not be injected.
 */
export function isSensitivePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  const base = path.basename(normalized);

  if (SENSITIVE_PATTERNS.some((p) => p.test(normalized) || p.test(base))) {
    return true;
  }

  // Check homedir-relative paths
  const homedir = os.homedir().replace(/\\/g, "/");
  if (normalized.startsWith(homedir)) {
    const rel = normalized.slice(homedir.length);
    if (rel.startsWith("/.ssh") || rel.startsWith("/.aws") || rel.startsWith("/.coreblow/.env")) {
      return true;
    }
  }

  return false;
}

/**
 * Detects if a buffer appears to be binary by checking for null bytes in first 512 bytes.
 */
export function isBinaryBuffer(buf: Buffer): boolean {
  const checkLen = Math.min(buf.length, 512);
  for (let i = 0; i < checkLen; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

/**
 * Expands a single @ context token.
 */
export function expandSingleContextToken(
  token: string,
  cwd: string = process.cwd(),
): { content: string; warning?: string; error?: string } {
  // 1. @diff
  if (token === "@diff") {
    try {
      const out = execSync("git diff", { cwd, encoding: "utf8", timeout: 5000 });
      return { content: out ? `\n\`\`\`diff\n${out}\n\`\`\`\n` : "(no uncommitted diff)" };
    } catch (err) {
      return { content: "", error: `Failed to get git diff: ${String(err)}` };
    }
  }

  // 2. @staged
  if (token === "@staged") {
    try {
      const out = execSync("git diff --cached", { cwd, encoding: "utf8", timeout: 5000 });
      return { content: out ? `\n\`\`\`diff\n${out}\n\`\`\`\n` : "(no staged diff)" };
    } catch (err) {
      return { content: "", error: `Failed to get staged diff: ${String(err)}` };
    }
  }

  // 3. @git:<N>
  const gitMatch = /^@git:(\d+)$/.exec(token);
  if (gitMatch) {
    const count = Math.min(10, Math.max(1, parseInt(gitMatch[1]!, 10)));
    try {
      const out = execSync(`git log -n ${count} --oneline`, { cwd, encoding: "utf8", timeout: 5000 });
      return { content: out ? `\n\`\`\`git-log\n${out}\n\`\`\`\n` : "(empty git log)" };
    } catch (err) {
      return { content: "", error: `Failed to get git log: ${String(err)}` };
    }
  }

  // 4. @folder:<dir>
  const folderMatch = /^@folder:(.+)$/.exec(token);
  if (folderMatch) {
    const dirRel = folderMatch[1]!.trim();
    const dirPath = path.resolve(cwd, dirRel);
    if (isSensitivePath(dirPath) || isSensitivePath(dirRel)) {
      return { content: "", error: `Blocked sensitive folder path: ${dirRel}` };
    }
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      return { content: "", error: `Directory not found: ${dirRel}` };
    }

    const files: string[] = [];
    const walk = (d: string) => {
      if (files.length >= 200) return;
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const e of entries) {
        if (files.length >= 200) break;
        if (e.name === "node_modules" || e.name === ".git" || e.name === "dist") continue;
        const full = path.join(d, e.name);
        const rel = path.relative(dirPath, full);
        if (e.isDirectory()) {
          walk(full);
        } else {
          files.push(rel);
        }
      }
    };
    try {
      walk(dirPath);
      const suffix = files.length >= 200 ? " (capped at 200 entries)" : "";
      return { content: `\nFolder ${dirRel}${suffix}:\n${files.map((f) => `  ${f}`).join("\n")}\n` };
    } catch (err) {
      return { content: "", error: `Failed to read folder ${dirRel}: ${String(err)}` };
    }
  }

  // 5. @file:<path> or @file:<path>:<start>-<end> or bare @<path>
  let rawFileRef = "";
  if (token.startsWith("@file:")) {
    rawFileRef = token.slice(6);
  } else if (token.startsWith("@") && token.length > 1) {
    rawFileRef = token.slice(1);
  } else {
    return { content: token };
  }

  let filePath = rawFileRef;
  let startLine: number | undefined;
  let endLine: number | undefined;

  const lineRangeMatch = /^(.*):(\d+)-(\d+)$/.exec(rawFileRef);
  if (lineRangeMatch) {
    filePath = lineRangeMatch[1]!;
    startLine = parseInt(lineRangeMatch[2]!, 10);
    endLine = parseInt(lineRangeMatch[3]!, 10);
  }

  const resolved = path.resolve(cwd, filePath);

  if (isSensitivePath(filePath) || isSensitivePath(resolved)) {
    return { content: "", error: `Blocked sensitive context path: ${filePath}` };
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    // If it was just a plain @mention (like @alice), don't error out, keep token
    if (!token.startsWith("@file:")) {
      return { content: token };
    }
    return { content: "", error: `File not found: ${filePath}` };
  }

  try {
    const rawBuffer = fs.readFileSync(resolved);
    if (isBinaryBuffer(rawBuffer)) {
      return { content: `[Binary file skipped: ${filePath}]` };
    }

    const text = rawBuffer.toString("utf8");
    if (startLine !== undefined && endLine !== undefined) {
      const lines = text.split("\n");
      const slice = lines.slice(Math.max(0, startLine - 1), endLine).join("\n");
      return {
        content: `\n\`\`\`${path.extname(filePath).slice(1) || "text"} (${filePath}:${startLine}-${endLine})\n${slice}\n\`\`\`\n`,
      };
    }

    return {
      content: `\n\`\`\`${path.extname(filePath).slice(1) || "text"} (${filePath})\n${text}\n\`\`\`\n`,
    };
  } catch (err) {
    return { content: "", error: `Error reading file ${filePath}: ${String(err)}` };
  }
}

/**
 * Parses and expands all @ context references within an input line, enforcing size and secret boundaries.
 */
export function expandContextReferences(
  input: string,
  cwd: string = process.cwd(),
  contextWindowChars: number = DEFAULT_CONTEXT_WINDOW_CHARS,
): ContextExpansionResult {
  const warnings: string[] = [];
  const tokens = input.match(/@(file:[^\s]+|folder:[^\s]+|git:\d+|diff|staged|[a-zA-Z0-9_./-]+)/g);

  if (!tokens || tokens.length === 0) {
    return { expanded: input, warnings };
  }

  let result = input;

  for (const token of tokens) {
    // Skip if it doesn't look like a context ref or file
    if (token === "@") continue;
    const res = expandSingleContextToken(token, cwd);

    if (res.error) {
      return {
        expanded: input,
        warnings,
        refused: res.error,
      };
    }

    if (res.warning) {
      warnings.push(res.warning);
    }

    result = result.replace(token, res.content);
  }

  // Budget checks
  const totalChars = result.length;
  if (totalChars > contextWindowChars * 0.5) {
    return {
      expanded: input,
      warnings,
      refused: `Context reference refused: expanded size (${Math.round(totalChars / 4)} tokens) exceeds 50% of active context window limit.`,
    };
  }

  if (totalChars > contextWindowChars * 0.25) {
    warnings.push(
      `Notice: Context references consume >25% of active context budget (${Math.round(totalChars / 4)} tokens).`,
    );
  }

  return { expanded: result, warnings };
}

/**
 * Fuzzy matches local files for bare @ autocomplete in composer.
 */
export function findMatchingFiles(query: string, cwd: string = process.cwd(), limit = 8): string[] {
  const q = query.toLowerCase().replace(/^@/, "");
  const results: string[] = [];

  const walk = (dir: string, depth = 0) => {
    if (results.length >= limit || depth > 4) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (results.length >= limit) break;
        if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "dist") continue;
        const full = path.join(dir, e.name);
        const rel = path.relative(cwd, full);
        if (e.isDirectory()) {
          walk(full, depth + 1);
        } else if (e.isFile()) {
          if (!q || rel.toLowerCase().includes(q)) {
            if (!isSensitivePath(rel)) {
              results.push(rel);
            }
          }
        }
      }
    } catch {}
  };

  walk(cwd);
  return results;
}
