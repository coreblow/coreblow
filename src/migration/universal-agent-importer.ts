/**
 * CoreBlow Stage 7 — Universal Workspace Profile Importer
 *
 * Implements pure Data-Oriented Programming (DOP) profile extraction,
 * zero-leak secret redaction, path traversal protection, and stateful
 * Object-Oriented Programming (OOP) lifecycle ingestion into Cory Memory
 * and Cory Skill Synthesizer.
 */

import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import {
  normalizeHyphenSlug,
  serializeEvolvingSkillMarkdown,
  type EvolvingSkillRecord,
  type SkillFitnessMetrics,
} from "../learning/dop-skill-distiller.js";
import type { CorySkillSynthesizerService } from "../learning/skill-synthesizer-service.js";
import type { CoryBootstrapService } from "../memory/cory.js";

// ---------------------------------------------------------------------------
// External Agent Sources & Import Contracts
// ---------------------------------------------------------------------------

export type ExternalAgentSource =
  | "coreblow-bundle"
  | "standard-agents-md"
  | "claude-code"
  | "cursor"
  | "codex"
  | "windsurf";

export interface ImportedAgentBundle {
  readonly source: ExternalAgentSource;
  readonly sourceDir: string;
  readonly dryRun: boolean;
  readonly identityMemories: readonly string[];
  readonly durableMemories: readonly string[];
  readonly activeConstraints: readonly string[];
  readonly bashAllowlist: readonly string[];
  readonly bashDenylist: readonly string[];
  readonly mcpServers: Readonly<Record<string, { command: string; args: readonly string[] }>>;
  readonly importedSkillNames: readonly string[];
  readonly redactedSecretsCount: number;
  readonly warnings: readonly string[];
  readonly importedSkills?: readonly EvolvingSkillRecord[];
}

export interface ParsedWorkspaceRules {
  readonly identity: readonly string[];
  readonly durable: readonly string[];
  readonly constraints: readonly string[];
  readonly bashAllow: readonly string[];
  readonly bashDeny: readonly string[];
}

// ---------------------------------------------------------------------------
// Pure Secret Redaction Boundary
// ---------------------------------------------------------------------------

export const REDACTED_SECRET_MARKER = "[REDACTED_SECRET]";

const RAW_SECRET_PATTERNS: ReadonlyArray<{
  readonly name: string;
  readonly regex: RegExp;
  readonly replace: (match: string, ...groups: string[]) => string;
}> = [
  // Anthropic API keys (must precede generic sk- to avoid partial replacement)
  {
    name: "anthropic-key",
    regex: /\bsk-ant-[A-Za-z0-9_-]{10,}\b/g,
    replace: () => REDACTED_SECRET_MARKER,
  },
  // OpenAI API keys (standard & project scoped sk-proj-...)
  {
    name: "openai-key",
    regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g,
    replace: () => REDACTED_SECRET_MARKER,
  },
  // GitHub Personal Access Tokens (classic & fine-grained)
  {
    name: "github-pat",
    regex: /\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
    replace: () => REDACTED_SECRET_MARKER,
  },
  // Slack bot tokens
  {
    name: "slack-token",
    regex: /\bxoxb-[A-Za-z0-9_-]{10,}\b/g,
    replace: () => REDACTED_SECRET_MARKER,
  },
  // Google Cloud / Firebase API keys
  {
    name: "google-aiza",
    regex: /\bAIza[0-9A-Za-z-_]{20,}\b/g,
    replace: () => REDACTED_SECRET_MARKER,
  },
  // HTTP Authorization Bearer tokens
  {
    name: "bearer-token",
    regex: /\bBearer:?\s+([A-Za-z0-9._~+/-]{16,}={0,2})\b/gi,
    replace: () => `Bearer ${REDACTED_SECRET_MARKER}`,
  },
  // Generic key-value assignment in config or code
  {
    name: "generic-secret",
    regex:
      /(["']?(?:api[_-]?key|secret|token|password|auth[_-]?token)["']?\s*[:=]\s*["'])([^"'\s]{16,})(["'])/gi,
    replace: (_match, p1, p2, p3) => {
      if (typeof p2 === "string" && p2.includes(REDACTED_SECRET_MARKER)) {
        return `${p1}${p2}${p3}`;
      }
      return `${p1}${REDACTED_SECRET_MARKER}${p3}`;
    },
  },
];

/**
 * Pure DOP function to scan, sanitize, and count secrets in any text string.
 */
export function redactSecretsInString(text: string): { sanitized: string; count: number } {
  if (typeof text !== "string" || text.length === 0) {
    return { sanitized: text, count: 0 };
  }

  let sanitized = text;
  let count = 0;

  for (const { regex, replace } of RAW_SECRET_PATTERNS) {
    sanitized = sanitized.replace(regex, (match, ...groups) => {
      if (match.includes(REDACTED_SECRET_MARKER)) {
        return match;
      }
      count++;
      return replace(match, ...groups);
    });
  }

  return { sanitized, count };
}

// ---------------------------------------------------------------------------
// Path Traversal & Filesystem Safety Verification
// ---------------------------------------------------------------------------

/**
 * Validates whether targetPath resides safely inside baseDir without path traversal
 * escaping sequences (..) or symlink escapes.
 */
export function isSafeChildPath(
  baseDir: string,
  targetPath: string,
): { safe: boolean; reason?: string } {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);

  // Check 1: Target path must be within resolvedBase directory boundary
  if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(resolvedBase + path.sep)) {
    return {
      safe: false,
      reason: `Path '${targetPath}' escapes base directory '${baseDir}'`,
    };
  }

  // Check 2: If file or symlink exists on disk, verify realpath
  if (fsSync.existsSync(resolvedTarget)) {
    try {
      const realBase = fsSync.realpathSync(resolvedBase);
      const realTarget = fsSync.realpathSync(resolvedTarget);
      if (realTarget !== realBase && !realTarget.startsWith(realBase + path.sep)) {
        return {
          safe: false,
          reason: `Path '${targetPath}' resolves to '${realTarget}', which escapes real base directory '${realBase}'`,
        };
      }
    } catch (err) {
      return {
        safe: false,
        reason: `Failed to resolve realpath for '${targetPath}': ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return { safe: true };
}

// ---------------------------------------------------------------------------
// Pure Rules & Memory Parsing
// ---------------------------------------------------------------------------

const NEGATIVE_RULE_PATTERN =
  /^(?:[-*]|\d+\.)?\s*(?:never\b|do not\b|don't\b|must not\b|strictly\b|prohibited\b|forbidden\b|no\s+[a-z])/i;
const ALLOWED_CMD_PATTERN =
  /^(?:[-*]|\d+\.)?\s*(?:allow(?:ed)?(?:\s*commands?)?:\s*)?`?([a-zA-Z0-9_.-]+(?:\s+[^`\n\r]+)?)`?/i;
const IDENTITY_LINE_PATTERN =
  /^(?:[-*]|\d+\.)?\s*(?:you are\b|i am\b|user persona:|the user is\b|role:|assistant is\b)/i;

/**
 * Pure DOP parser that extracts structured identity memories, durable memories,
 * active constraints, and bash command allow/denylists from markdown content.
 */
export function parseWorkspaceRules(markdown: string, filename?: string): ParsedWorkspaceRules {
  const identity: string[] = [];
  const durable: string[] = [];
  const constraints: string[] = [];
  const bashAllow: string[] = [];
  const bashDeny: string[] = [];

  if (typeof markdown !== "string" || markdown.trim().length === 0) {
    return { identity, durable, constraints, bashAllow, bashDeny };
  }

  const baseName = filename ? path.basename(filename) : "";

  // Dedicated single-purpose file handling
  if (baseName === "USER.md" || baseName === "SOUL.md") {
    const lines = markdown.split("\n");
    for (const rawLine of lines) {
      const clean = rawLine.replace(/^[-*]|\d+\.\s*/, "").trim();
      if (clean && !clean.startsWith("#")) {
        identity.push(clean);
      }
    }
    return {
      identity: Object.freeze(identity),
      durable: Object.freeze(durable),
      constraints: Object.freeze(constraints),
      bashAllow: Object.freeze(bashAllow),
      bashDeny: Object.freeze(bashDeny),
    };
  }

  if (baseName === "MEMORY.md") {
    const lines = markdown.split("\n");
    for (const rawLine of lines) {
      const clean = rawLine.replace(/^[-*]|\d+\.\s*/, "").trim();
      if (clean && !clean.startsWith("#")) {
        durable.push(clean);
      }
    }
    return {
      identity: Object.freeze(identity),
      durable: Object.freeze(durable),
      constraints: Object.freeze(constraints),
      bashAllow: Object.freeze(bashAllow),
      bashDeny: Object.freeze(bashDeny),
    };
  }

  if (baseName === "CONSTRAINTS.md") {
    const lines = markdown.split("\n");
    for (const rawLine of lines) {
      const clean = rawLine.replace(/^[-*]|\d+\.\s*/, "").trim();
      if (clean && !clean.startsWith("#")) {
        constraints.push(clean);
      }
    }
    return {
      identity: Object.freeze(identity),
      durable: Object.freeze(durable),
      constraints: Object.freeze(constraints),
      bashAllow: Object.freeze(bashAllow),
      bashDeny: Object.freeze(bashDeny),
    };
  }

  // Multi-section parser for CLAUDE.md, AGENTS.md, .cursorrules, .windsurfrules, etc.
  const lines = markdown.split("\n");
  let currentCategory:
    | "identity"
    | "durable"
    | "constraints"
    | "bashAllow"
    | "bashDeny"
    | "default" = "default";

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Detect markdown headings
    if (trimmed.startsWith("#")) {
      const heading = trimmed.replace(/^#+\s*/, "").toLowerCase();
      if (
        /identity|persona|soul|profile|user\s*preferences?|who\s+you\s+are|role\b/i.test(heading)
      ) {
        currentCategory = "identity";
      } else if (
        /bash\s*allow|allowed\s*commands?|command\s*allow|allowlist|allowed\s*tools?/i.test(heading)
      ) {
        currentCategory = "bashAllow";
      } else if (
        /bash\s*deny|denied\s*commands?|command\s*deny|forbidden\s*commands?|denylist|prohibited\s*actions?/i.test(
          heading,
        )
      ) {
        currentCategory = "bashDeny";
      } else if (
        /constraints?|rules?|safety|security|guardrails?|restrictions?|prohibited|forbidden|don't|never/i.test(
          heading,
        )
      ) {
        currentCategory = "constraints";
      } else if (
        /memory|memories|architecture|guidelines?|conventions?|decisions?|workflows?|knowledge|context|notes?/i.test(
          heading,
        )
      ) {
        currentCategory = "durable";
      } else {
        currentCategory = "default";
      }
      continue;
    }

    const cleanItem = trimmed.replace(/^[-*]\s+|\d+\.\s+/, "").trim();
    if (!cleanItem) continue;

    // Route line based on category or heuristics
    if (currentCategory === "identity") {
      identity.push(cleanItem);
    } else if (currentCategory === "constraints") {
      constraints.push(cleanItem);
    } else if (currentCategory === "bashAllow") {
      const cmdMatch = cleanItem.match(/`([^`]+)`/) ?? cleanItem.match(ALLOWED_CMD_PATTERN);
      const cmd = cmdMatch ? cmdMatch[1].trim() : cleanItem;
      if (cmd) bashAllow.push(cmd);
    } else if (currentCategory === "bashDeny") {
      const cmdMatch = cleanItem.match(/`([^`]+)`/) ?? cleanItem.match(ALLOWED_CMD_PATTERN);
      const cmd = cmdMatch ? cmdMatch[1].trim() : cleanItem;
      if (cmd) bashDeny.push(cmd);
    } else if (NEGATIVE_RULE_PATTERN.test(cleanItem)) {
      constraints.push(cleanItem);
    } else if (currentCategory === "durable") {
      durable.push(cleanItem);
    } else {
      // Heuristic categorization for unclassified sections or flat rules
      if (IDENTITY_LINE_PATTERN.test(cleanItem)) {
        identity.push(cleanItem);
      } else {
        durable.push(cleanItem);
      }
    }
  }

  return {
    identity: Object.freeze(Array.from(new Set(identity))),
    durable: Object.freeze(Array.from(new Set(durable))),
    constraints: Object.freeze(Array.from(new Set(constraints))),
    bashAllow: Object.freeze(Array.from(new Set(bashAllow))),
    bashDeny: Object.freeze(Array.from(new Set(bashDeny))),
  };
}

// ---------------------------------------------------------------------------
// Pure MCP Server Config Parsing
// ---------------------------------------------------------------------------

/**
 * Parses MCP server definitions from mcp.json or config.yaml, redacting secrets
 * and stripping sensitive inline env variables.
 */
export function parseMcpServerConfigFile(
  content: string,
  filePath: string,
): {
  servers: Record<string, { command: string; args: readonly string[] }>;
  redactedCount: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  const { sanitized, count: textRedactedCount } = redactSecretsInString(content);
  let totalRedacted = textRedactedCount;

  let parsed: unknown;
  try {
    if (filePath.endsWith(".yaml") || filePath.endsWith(".yml")) {
      parsed = YAML.parse(sanitized);
    } else {
      parsed = JSON.parse(sanitized);
    }
  } catch (err) {
    warnings.push(
      `Failed to parse MCP configuration file '${filePath}': ${err instanceof Error ? err.message : String(err)}`,
    );
    return { servers: {}, redactedCount: totalRedacted, warnings };
  }

  if (!parsed || typeof parsed !== "object") {
    return { servers: {}, redactedCount: totalRedacted, warnings };
  }

  const rootObj = parsed as Record<string, unknown>;
  const rawServers =
    (rootObj.mcpServers as Record<string, unknown> | undefined) ??
    (rootObj.servers as Record<string, unknown> | undefined) ??
    {};

  const servers: Record<string, { command: string; args: readonly string[] }> = {};

  for (const [serverName, serverVal] of Object.entries(rawServers)) {
    if (!serverVal || typeof serverVal !== "object") continue;

    const conf = serverVal as Record<string, unknown>;
    const rawCommand = String(conf.command ?? "").trim();
    const rawArgs = Array.isArray(conf.args) ? conf.args.map((a) => String(a)) : [];

    // Redact command and args if any raw secrets are present
    const cmdRedacted = redactSecretsInString(rawCommand);
    totalRedacted += cmdRedacted.count;

    const sanitizedArgs: string[] = [];
    for (const arg of rawArgs) {
      const argRedacted = redactSecretsInString(arg);
      totalRedacted += argRedacted.count;

      // Check for path traversal sequences in args
      if (arg.includes("..") && (arg.includes("/") || arg.includes("\\"))) {
        warnings.push(
          `MCP server '${serverName}' contains potential path traversal argument: '${arg}'`,
        );
      }
      sanitizedArgs.push(argRedacted.sanitized);
    }

    // Strip inline env secrets and count them
    if (conf.env && typeof conf.env === "object") {
      const envObj = conf.env as Record<string, unknown>;
      for (const [envKey, envVal] of Object.entries(envObj)) {
        const envValStr = String(envVal ?? "");
        if (
          /key|secret|token|password|auth/i.test(envKey) ||
          envValStr.includes(REDACTED_SECRET_MARKER) ||
          redactSecretsInString(envValStr).count > 0
        ) {
          totalRedacted++;
        }
      }
    }

    servers[serverName] = {
      command: cmdRedacted.sanitized,
      args: Object.freeze(sanitizedArgs),
    };
  }

  return { servers, redactedCount: totalRedacted, warnings };
}

// ---------------------------------------------------------------------------
// Skill File Extraction Helper
// ---------------------------------------------------------------------------

async function parseExternalSkillFile(
  filePath: string,
  fallbackName: string,
): Promise<{
  skill: EvolvingSkillRecord | null;
  redactedCount: number;
  warnings: string[];
}> {
  const warnings: string[] = [];
  let rawContent: string;
  try {
    rawContent = await fs.readFile(filePath, "utf-8");
  } catch (err) {
    warnings.push(
      `Failed to read skill file '${filePath}': ${err instanceof Error ? err.message : String(err)}`,
    );
    return { skill: null, redactedCount: 0, warnings };
  }

  const { sanitized, count: redactedCount } = redactSecretsInString(rawContent);

  // Check YAML frontmatter
  let frontmatter: Record<string, unknown> = {};
  let body = sanitized;

  if (sanitized.startsWith("---")) {
    const endHeaderIdx = sanitized.indexOf("\n---", 3);
    if (endHeaderIdx !== -1) {
      const frontmatterRaw = sanitized.slice(4, endHeaderIdx);
      try {
        const parsedYml = YAML.parse(frontmatterRaw);
        if (parsedYml && typeof parsedYml === "object" && !Array.isArray(parsedYml)) {
          frontmatter = parsedYml as Record<string, unknown>;
        }
      } catch {
        warnings.push(`Malformed YAML frontmatter in skill '${filePath}'`);
      }
      body = sanitized.slice(endHeaderIdx + 4).trim();
    }
  }

  const rawName = String(
    frontmatter.name ?? frontmatter.title ?? frontmatter.id ?? frontmatter.slug ?? fallbackName,
  );
  const slug = normalizeHyphenSlug(rawName);

  // Extract procedure steps
  const bodyLines = body.split("\n");
  const procedureSteps: string[] = [];
  const pitfalls: string[] = [];
  let inProcedure = false;
  let inPitfalls = false;

  for (const line of bodyLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      const heading = trimmed.slice(3).toLowerCase();
      if (
        /verified\s*procedure|execution\s*strategy|instructions?|steps?|procedure/i.test(heading)
      ) {
        inProcedure = true;
        inPitfalls = false;
        continue;
      } else if (/pitfalls?|active\s*constraints?|constraints?|limitations?/i.test(heading)) {
        inPitfalls = true;
        inProcedure = false;
        continue;
      } else {
        inProcedure = false;
        inPitfalls = false;
      }
    }

    if (inProcedure) {
      const step = trimmed.replace(/^[-*]\s+|\d+\.\s+/, "").trim();
      if (step && !step.startsWith("#")) {
        procedureSteps.push(step);
      }
    } else if (inPitfalls) {
      const pitfall = trimmed.replace(/^[-*]\s+|\d+\.\s+/, "").trim();
      if (pitfall && !pitfall.startsWith("#")) {
        pitfalls.push(pitfall);
      }
    }
  }

  // Fallback procedure if explicit sections not found
  if (procedureSteps.length === 0) {
    for (const line of bodyLines) {
      const step = line
        .trim()
        .replace(/^[-*]\s+|\d+\.\s+/, "")
        .trim();
      if (step && !step.startsWith("#") && !step.startsWith("```")) {
        procedureSteps.push(step);
        if (procedureSteps.length >= 5) break;
      }
    }
  }

  if (procedureSteps.length === 0) {
    procedureSteps.push(`Execute ${rawName} workflow according to defined guidelines.`);
  }

  const now = Date.now();
  const metricsRecord: SkillFitnessMetrics = Object.freeze({
    invocations: 0,
    successes: 0,
    failures: 0,
    consecutiveFailures: 0,
    wilsonScore: 0.5,
    avgTurnsSaved: 0,
    lastVerifiedAt: new Date(now).toISOString(),
    totalInvocations: 0,
    successfulInvocations: 0,
    failedInvocations: 0,
    lastUpdatedMs: now,
  });

  const skillRecord: EvolvingSkillRecord = Object.freeze({
    id: slug,
    name: rawName,
    title: rawName,
    slug,
    version: String(frontmatter.version ?? "1.0.0"),
    description: String(frontmatter.description ?? `Imported skill '${rawName}'`),
    status: "candidate",
    category: String(frontmatter.category ?? "imported"),
    triggers: Array.isArray(frontmatter.triggers)
      ? Object.freeze(frontmatter.triggers.map((t) => String(t)))
      : Object.freeze([slug]),
    tools: Array.isArray(frontmatter.tools)
      ? Object.freeze(frontmatter.tools.map((t) => String(t)))
      : Object.freeze([]),
    whenToUse: String(frontmatter.whenToUse ?? `Use when executing ${rawName} workflows.`),
    verifiedProcedure: Object.freeze(procedureSteps),
    executionStrategy: Object.freeze(procedureSteps),
    pitfallsAndConstraints: Object.freeze(pitfalls),
    pitfallsConstraints: Object.freeze(pitfalls),
    verificationGate: String(
      frontmatter.verificationGate ?? "Confirm clean command execution with exit code 0.",
    ),
    verificationCriteria: Object.freeze(pitfalls.length > 0 ? pitfalls : ["Exit code 0"]),
    fitness: metricsRecord,
    metrics: metricsRecord,
    workspaceId: String(frontmatter.workspaceId ?? "default"),
    createdAtMs: now,
    updatedAt: now,
    updatedAtMs: now,
    locked: Boolean(frontmatter.locked ?? false),
  });

  return { skill: skillRecord, redactedCount, warnings };
}

// ---------------------------------------------------------------------------
// Pure DOP Source Scanner & Sanitizer
// ---------------------------------------------------------------------------

/**
 * Scans an external workspace directory, redacts secrets, blocks path traversal,
 * and compiles an immutable ImportedAgentBundle.
 */
export async function scanAndSanitizeImportSource(params: {
  source: ExternalAgentSource;
  sourceDir: string;
  dryRun?: boolean;
}): Promise<ImportedAgentBundle> {
  const { source, sourceDir } = params;
  const dryRun = params.dryRun ?? true;
  const warnings: string[] = [];

  const identityMemories: string[] = [];
  const durableMemories: string[] = [];
  const activeConstraints: string[] = [];
  const bashAllowlist: string[] = [];
  const bashDenylist: string[] = [];
  let mcpServers: Record<string, { command: string; args: readonly string[] }> = {};
  const importedSkills: EvolvingSkillRecord[] = [];
  const importedSkillNames: string[] = [];
  let totalRedactedSecrets = 0;

  const resolvedSourceDir = path.resolve(sourceDir);

  if (!fsSync.existsSync(resolvedSourceDir)) {
    warnings.push(`Source directory does not exist: '${sourceDir}'`);
    return Object.freeze({
      source,
      sourceDir: resolvedSourceDir,
      dryRun,
      identityMemories: Object.freeze([]),
      durableMemories: Object.freeze([]),
      activeConstraints: Object.freeze([]),
      bashAllowlist: Object.freeze([]),
      bashDenylist: Object.freeze([]),
      mcpServers: Object.freeze({}),
      importedSkillNames: Object.freeze([]),
      redactedSecretsCount: 0,
      warnings: Object.freeze(warnings),
      importedSkills: Object.freeze([]),
    });
  }

  // ─── 1. Candidate Rule & Instruction Files ──────────────────────────────
  const candidateRuleFiles = [
    "CLAUDE.md",
    ".cursorrules",
    ".windsurfrules",
    "AGENTS.md",
    "SOUL.md",
    "USER.md",
    "MEMORY.md",
    "CONSTRAINTS.md",
  ];

  for (const relFile of candidateRuleFiles) {
    const fullPath = path.join(resolvedSourceDir, relFile);
    const safetyCheck = isSafeChildPath(resolvedSourceDir, fullPath);
    if (!safetyCheck.safe) {
      warnings.push(`Path traversal blocked for file '${relFile}': ${safetyCheck.reason}`);
      continue;
    }

    if (fsSync.existsSync(fullPath)) {
      try {
        const rawText = await fs.readFile(fullPath, "utf-8");
        const { sanitized, count } = redactSecretsInString(rawText);
        totalRedactedSecrets += count;

        const parsed = parseWorkspaceRules(sanitized, relFile);
        identityMemories.push(...parsed.identity);
        durableMemories.push(...parsed.durable);
        activeConstraints.push(...parsed.constraints);
        bashAllowlist.push(...parsed.bashAllow);
        bashDenylist.push(...parsed.bashDeny);
      } catch (err) {
        warnings.push(
          `Failed to read rules file '${relFile}': ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  // Check Cursor rules directory: .cursor/rules/*.mdc or *.md
  const cursorRulesDir = path.join(resolvedSourceDir, ".cursor", "rules");
  if (fsSync.existsSync(cursorRulesDir)) {
    const safetyCheck = isSafeChildPath(resolvedSourceDir, cursorRulesDir);
    if (safetyCheck.safe) {
      try {
        const entries = await fs.readdir(cursorRulesDir);
        for (const entry of entries) {
          if (!entry.endsWith(".md") && !entry.endsWith(".mdc")) continue;
          const entryPath = path.join(cursorRulesDir, entry);
          const entrySafety = isSafeChildPath(resolvedSourceDir, entryPath);
          if (!entrySafety.safe) {
            warnings.push(
              `Path traversal blocked for cursor rule '${entry}': ${entrySafety.reason}`,
            );
            continue;
          }
          const raw = await fs.readFile(entryPath, "utf-8");
          const { sanitized, count } = redactSecretsInString(raw);
          totalRedactedSecrets += count;
          const parsed = parseWorkspaceRules(sanitized, entry);
          identityMemories.push(...parsed.identity);
          durableMemories.push(...parsed.durable);
          activeConstraints.push(...parsed.constraints);
          bashAllowlist.push(...parsed.bashAllow);
          bashDenylist.push(...parsed.bashDeny);
        }
      } catch (err) {
        warnings.push(
          `Failed to read cursor rules directory: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  // ─── 2. MCP Configurations ─────────────────────────────────────────────
  const candidateMcpFiles = [
    "mcp.json",
    ".mcp.json",
    path.join(".cursor", "mcp.json"),
    path.join(".claude", "mcp.json"),
    "config.yaml",
  ];

  for (const relFile of candidateMcpFiles) {
    const fullPath = path.join(resolvedSourceDir, relFile);
    const safetyCheck = isSafeChildPath(resolvedSourceDir, fullPath);
    if (!safetyCheck.safe) {
      warnings.push(`Path traversal blocked for MCP config '${relFile}': ${safetyCheck.reason}`);
      continue;
    }

    if (fsSync.existsSync(fullPath)) {
      try {
        const rawContent = await fs.readFile(fullPath, "utf-8");
        const parsedMcp = parseMcpServerConfigFile(rawContent, relFile);
        totalRedactedSecrets += parsedMcp.redactedCount;
        warnings.push(...parsedMcp.warnings);
        mcpServers = { ...mcpServers, ...parsedMcp.servers };
      } catch (err) {
        warnings.push(
          `Failed to read MCP config '${relFile}': ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  // ─── 3. External Skills Discovery ───────────────────────────────────────
  const candidateSkillDirs = [
    path.join(resolvedSourceDir, "skills"),
    path.join(resolvedSourceDir, ".claude", "skills"),
    path.join(resolvedSourceDir, ".cursor", "skills"),
  ];

  for (const skillBaseDir of candidateSkillDirs) {
    if (!fsSync.existsSync(skillBaseDir)) continue;
    const dirSafety = isSafeChildPath(resolvedSourceDir, skillBaseDir);
    if (!dirSafety.safe) {
      warnings.push(`Path traversal blocked for skills directory: ${dirSafety.reason}`);
      continue;
    }

    try {
      const entries = await fs.readdir(skillBaseDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillDirPath = path.join(skillBaseDir, entry.name);
          const skillFile = path.join(skillDirPath, "SKILL.md");
          const childSafety = isSafeChildPath(resolvedSourceDir, skillFile);
          if (!childSafety.safe) {
            warnings.push(
              `Path traversal blocked for skill '${entry.name}/SKILL.md': ${childSafety.reason}`,
            );
            continue;
          }

          if (fsSync.existsSync(skillFile)) {
            const parsed = await parseExternalSkillFile(skillFile, entry.name);
            totalRedactedSecrets += parsed.redactedCount;
            warnings.push(...parsed.warnings);
            if (parsed.skill) {
              importedSkills.push(parsed.skill);
              importedSkillNames.push(parsed.skill.name);
            }
          }
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
          const singleSkillPath = path.join(skillBaseDir, entry.name);
          const singleSafety = isSafeChildPath(resolvedSourceDir, singleSkillPath);
          if (!singleSafety.safe) {
            warnings.push(
              `Path traversal blocked for skill file '${entry.name}': ${singleSafety.reason}`,
            );
            continue;
          }
          const baseNameNoExt = entry.name.replace(/\.md$/, "");
          const parsed = await parseExternalSkillFile(singleSkillPath, baseNameNoExt);
          totalRedactedSecrets += parsed.redactedCount;
          warnings.push(...parsed.warnings);
          if (parsed.skill) {
            importedSkills.push(parsed.skill);
            importedSkillNames.push(parsed.skill.name);
          }
        }
      }
    } catch (err) {
      warnings.push(
        `Failed to scan skills directory '${skillBaseDir}': ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Deduplicate items while maintaining order
  const uniqueIdentity = Array.from(new Set(identityMemories));
  const uniqueDurable = Array.from(new Set(durableMemories));
  const uniqueConstraints = Array.from(new Set(activeConstraints));
  const uniqueBashAllow = Array.from(new Set(bashAllowlist));
  const uniqueBashDeny = Array.from(new Set(bashDenylist));
  const uniqueSkillNames = Array.from(new Set(importedSkillNames));

  return Object.freeze({
    source,
    sourceDir: resolvedSourceDir,
    dryRun,
    identityMemories: Object.freeze(uniqueIdentity),
    durableMemories: Object.freeze(uniqueDurable),
    activeConstraints: Object.freeze(uniqueConstraints),
    bashAllowlist: Object.freeze(uniqueBashAllow),
    bashDenylist: Object.freeze(uniqueBashDeny),
    mcpServers: Object.freeze(mcpServers),
    importedSkillNames: Object.freeze(uniqueSkillNames),
    redactedSecretsCount: totalRedactedSecrets,
    warnings: Object.freeze(warnings),
    importedSkills: Object.freeze(importedSkills),
  });
}

// ---------------------------------------------------------------------------
// OOP Universal Agent Importer Service
// ---------------------------------------------------------------------------

export interface ApplyImportParams {
  readonly source: ExternalAgentSource;
  readonly sourceDir: string;
  readonly workspaceId?: string;
  readonly cory: CoryBootstrapService;
  readonly skillSynthesizer?: CorySkillSynthesizerService;
}

export class UniversalAgentImporterService {
  /**
   * Dry-run preview: Scans external workspace and extracts memories, constraints,
   * commands, MCP servers, and skills without committing changes to disk.
   */
  public async previewImport(params: {
    source: ExternalAgentSource;
    sourceDir: string;
  }): Promise<ImportedAgentBundle> {
    return scanAndSanitizeImportSource({
      source: params.source,
      sourceDir: params.sourceDir,
      dryRun: true,
    });
  }

  /**
   * Applies import: Commits sanitized memories to Cory memory layers and
   * evaluates & registers valid skills in Cory Skill Synthesizer.
   */
  public async applyImport(params: ApplyImportParams): Promise<ImportedAgentBundle> {
    const bundle = await scanAndSanitizeImportSource({
      source: params.source,
      sourceDir: params.sourceDir,
      dryRun: false,
    });

    const workspaceId = params.workspaceId ?? "default";
    const userScope = "default";
    const scope = { workspaceId, userScope };

    // 1. Ingest identity memories -> USER.md
    for (const item of bundle.identityMemories) {
      params.cory.memoryStore.remember({
        layer: "identity",
        content: item,
        scope,
        source: `import:${bundle.source}`,
        tags: ["imported", "identity", bundle.source],
      });
    }

    // 2. Ingest durable memories -> MEMORY.md
    for (const item of bundle.durableMemories) {
      params.cory.memoryStore.remember({
        layer: "durable",
        content: item,
        scope,
        source: `import:${bundle.source}`,
        tags: ["imported", "durable", bundle.source],
      });
    }

    // 3. Ingest active constraints -> CONSTRAINTS.md
    for (const item of bundle.activeConstraints) {
      params.cory.memoryStore.remember({
        layer: "constraint",
        content: item,
        scope,
        source: `import:${bundle.source}`,
        tags: ["imported", "constraint", bundle.source],
      });
    }

    // 4. Ingest and evaluate skills through CorySkillSynthesizerService
    const validSkills: EvolvingSkillRecord[] = [];
    const importWarnings = [...bundle.warnings];

    if (bundle.importedSkills && bundle.importedSkills.length > 0) {
      for (const skill of bundle.importedSkills) {
        const serialized = serializeEvolvingSkillMarkdown(skill);

        if (params.skillSynthesizer) {
          const securityCheck = params.skillSynthesizer.evaluateSkillSecurity(serialized, skill.id);

          if (!securityCheck.allowed) {
            importWarnings.push(
              `Skill '${skill.id}' failed security gate: ${securityCheck.reason ?? securityCheck.error}`,
            );
            continue;
          }

          // Register in-memory if skills Map exists
          const synMap = (
            params.skillSynthesizer as unknown as { skills?: Map<string, EvolvingSkillRecord> }
          ).skills;
          if (synMap instanceof Map) {
            synMap.set(skill.id, skill);
          }

          // Persist skill markdown if learnedDir exists
          const synLearnedDir = (params.skillSynthesizer as unknown as { learnedDir?: string })
            .learnedDir;
          if (typeof synLearnedDir === "string") {
            try {
              const destPath = path.join(synLearnedDir, `${skill.id}.md`);
              await fs.mkdir(path.dirname(destPath), { recursive: true });
              await fs.writeFile(destPath, serialized, "utf-8");
            } catch {
              // Persistence error handled gracefully
            }
          }
        }

        // Index imported skill in Cory memory store
        try {
          params.cory.memoryStore.remember({
            layer: "durable",
            content: `[LEARNED_SKILL] ${skill.name} (v${skill.version}): ${skill.description}\n\nProcedure:\n${skill.verifiedProcedure.join("\n")}`,
            scope,
            source: `import:${bundle.source}`,
            tags: ["imported-skill", skill.id, skill.status],
          });
        } catch {
          // Indexing in Cory is non-fatal
        }

        validSkills.push(skill);
      }
    }

    return Object.freeze({
      ...bundle,
      warnings: Object.freeze(importWarnings),
      importedSkills: Object.freeze(validSkills),
    });
  }
}
