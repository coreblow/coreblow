/**
 * CoreBlow — Cory Knowledge Scribe, Browsable Memory Wiki & Zero-Stall Prepared Compaction
 *
 * Implements pure Data-Oriented Programming (DOP) contracts and transformations
 * alongside the stateful Object-Oriented (OOP) GatewayService for persistent
 * wiki authoring, audit panels, and prompt-cache-stable background compactions.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import type { GatewayService, ServiceHealth } from "../gateway/service-registry.js";
import type { EvolvingSkillRecord } from "../learning/dop-skill-distiller.js";
import type { CorySkillSynthesizerService } from "../learning/skill-synthesizer-service.js";
import {
  type CoryBootstrapService,
  type CoryMemoryItem,
  type CoryScope,
  isTrustedForDurablePromotion,
} from "./cory.js";

// ============================================================================
// 1. Pure DOP Data Contracts
// ============================================================================

export type WikiTopicCategory =
  | "architecture"
  | "decisions"
  | "constraints"
  | "workflows"
  | "daily_log"
  | "identity";

export interface WikiTopicPage {
  readonly slug: string;
  readonly title: string;
  readonly category: WikiTopicCategory;
  readonly summary: string;
  readonly markdownBody: string;
  readonly sourceSessionIds: readonly string[];
  readonly linkedSkillIds: readonly string[];
  readonly updatedAtMs: number;
}

export interface PreparedCompactionArtifact {
  readonly sessionId: string;
  readonly activeHumanRequest: string;
  readonly toolDefinitionsHash: string;
  readonly preservedConstraints: readonly string[];
  readonly compactedSummary: string;
  readonly preparedAtMs: number;
}

export interface CompileWikiTopicPagesParams {
  readonly identityItems: readonly CoryMemoryItem[];
  readonly durableItems: readonly CoryMemoryItem[];
  readonly constraintItems: readonly CoryMemoryItem[];
  readonly episodicItems: readonly CoryMemoryItem[];
  readonly learnedSkills?: readonly EvolvingSkillRecord[];
}

export interface PrepareZeroStallCompactionParams {
  readonly sessionId: string;
  readonly messages: ReadonlyArray<{ readonly role: string; readonly content: string }>;
  readonly toolNames: readonly string[];
  readonly activeConstraints: readonly string[];
}

export interface CaptureScribeNoteParams {
  readonly sessionId: string;
  readonly title: string;
  readonly category?: WikiTopicCategory;
  readonly insights: readonly string[];
  readonly decisions?: readonly string[];
  readonly constraints?: readonly string[];
  readonly scope?: CoryScope;
}

export interface MemoryWikiSnapshot {
  readonly pages: readonly WikiTopicPage[];
  readonly auditPanel: {
    readonly userMdPath: string;
    readonly memoryMdPath: string;
    readonly constraintsMdPath: string;
    readonly totalPages: number;
  };
}

export interface CoryKnowledgeScribeServiceOptions {
  readonly cory: CoryBootstrapService;
  readonly skillSynthesizer?: CorySkillSynthesizerService;
  readonly wikiDir?: string;
}

// ============================================================================
// 2. Pure DOP Helper & Transformation Functions
// ============================================================================

/**
 * Generate a URL-friendly, filesystem-safe slug from a human-readable title.
 */
export function slugifyTitle(title: string): string {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "topic";
}

/**
 * Extracts a calendar day string (YYYY-MM-DD) from an episodic memory item.
 */
function extractDateKeyFromEpisodicItem(item: CoryMemoryItem): string {
  if (item.source) {
    const match = item.source.match(/(\d{4}-\d{2}-\d{2})/);
    if (match?.[1]) {
      return match[1];
    }
  }
  for (const tag of item.tags) {
    const match = tag.match(/(\d{4}-\d{2}-\d{2})/);
    if (match?.[1]) {
      return match[1];
    }
  }
  if (item.createdAt > 0) {
    const date = new Date(item.createdAt);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Compiles local Cory memory items and learned skills into browsable,
 * cross-linked wiki pages without mutating underlying canonical memory files.
 */
export function compileWikiTopicPagesFromCory(
  params: CompileWikiTopicPagesParams,
): readonly WikiTopicPage[] {
  const pages: WikiTopicPage[] = [];
  const now = Date.now();

  // 1. Identity Overview Page
  const identityUpdated =
    params.identityItems.length > 0
      ? Math.max(...params.identityItems.map((item) => item.updatedAt || item.createdAt || now))
      : now;
  const identityBody =
    params.identityItems.length > 0
      ? params.identityItems
          .map((item) => {
            const tagSuffix = item.tags.length > 0 ? ` _[${item.tags.join(", ")}]_` : "";
            return `- ${item.content}${tagSuffix}`;
          })
          .join("\n")
      : "_No identity preferences or user profile directives recorded yet._";

  const identitySourceSessions = Array.from(
    new Set(
      params.identityItems
        .map((item) => item.source)
        .filter((src): src is string => typeof src === "string" && src.length > 0),
    ),
  );

  pages.push({
    slug: "identity-overview",
    title: "Identity & User Profile Overview",
    category: "identity",
    summary: `Persistent identity traits and user preferences (${params.identityItems.length} record(s)).`,
    markdownBody: `# Identity & User Profile Overview\n\n${identityBody}\n`,
    sourceSessionIds: Object.freeze(identitySourceSessions),
    linkedSkillIds: Object.freeze([]),
    updatedAtMs: identityUpdated,
  });

  // 2. Architecture & Decisions Page
  const durableUpdated =
    params.durableItems.length > 0
      ? Math.max(...params.durableItems.map((item) => item.updatedAt || item.createdAt || now))
      : now;
  const durableBody =
    params.durableItems.length > 0
      ? params.durableItems
          .map((item) => {
            const tagSuffix = item.tags.length > 0 ? ` _[${item.tags.join(", ")}]_` : "";
            return `- ${item.content}${tagSuffix}`;
          })
          .join("\n")
      : "_No durable architecture or design decisions recorded yet._";

  const durableSourceSessions = Array.from(
    new Set(
      params.durableItems
        .map((item) => item.source)
        .filter((src): src is string => typeof src === "string" && src.length > 0),
    ),
  );

  pages.push({
    slug: "architecture-decisions",
    title: "Architecture & Durable Decisions",
    category: "decisions",
    summary: `Durable architectural and design decisions (${params.durableItems.length} record(s)).`,
    markdownBody: `# Architecture & Durable Decisions\n\n${durableBody}\n`,
    sourceSessionIds: Object.freeze(durableSourceSessions),
    linkedSkillIds: Object.freeze([]),
    updatedAtMs: durableUpdated,
  });

  // 3. Active Constraints Page
  const constraintUpdated =
    params.constraintItems.length > 0
      ? Math.max(...params.constraintItems.map((item) => item.updatedAt || item.createdAt || now))
      : now;
  const constraintBody =
    params.constraintItems.length > 0
      ? params.constraintItems
          .map((item) => {
            const immSuffix = item.immutableConstraint ? " **(immutable)**" : "";
            return `- ${item.content}${immSuffix}`;
          })
          .join("\n")
      : "_No active hard constraints or invariants recorded yet._";

  const constraintSourceSessions = Array.from(
    new Set(
      params.constraintItems
        .map((item) => item.source)
        .filter((src): src is string => typeof src === "string" && src.length > 0),
    ),
  );

  pages.push({
    slug: "active-constraints",
    title: "Active Invariants & Hard Constraints",
    category: "constraints",
    summary: `Active invariants and behavioral constraints (${params.constraintItems.length} constraint(s)).`,
    markdownBody: `# Active Invariants & Hard Constraints\n\n${constraintBody}\n`,
    sourceSessionIds: Object.freeze(constraintSourceSessions),
    linkedSkillIds: Object.freeze([]),
    updatedAtMs: constraintUpdated,
  });

  // 4. Learned Skills Catalog Page
  const skills = params.learnedSkills ?? [];
  const skillsUpdated =
    skills.length > 0 ? Math.max(...skills.map((s) => s.updatedAtMs ?? s.updatedAt ?? now)) : now;
  const skillsBody =
    skills.length > 0
      ? skills
          .map((skill) => {
            const triggers =
              skill.triggers.length > 0 ? `\n  - Triggers: \`${skill.triggers.join("`, `")}\`` : "";
            const tools =
              skill.tools.length > 0 ? `\n  - Tools: \`${skill.tools.join("`, `")}\`` : "";
            const lockedBadge = skill.locked ? " 🔒" : "";
            return `### ${skill.title || skill.name}${lockedBadge} (\`${skill.id}\`)\n- **Status**: \`${skill.status}\` | **Category**: \`${skill.category}\`\n- ${skill.description}${triggers}${tools}`;
          })
          .join("\n\n")
      : "_No evolving skills or synthesized workflows registered yet._";

  const linkedSkillIds = skills.map((s) => s.id);

  pages.push({
    slug: "learned-skills-catalog",
    title: "Learned Skills & Workflow Catalog",
    category: "workflows",
    summary: `Self-synthesized capabilities and evolving workflows (${skills.length} skill(s)).`,
    markdownBody: `# Learned Skills & Workflow Catalog\n\n${skillsBody}\n`,
    sourceSessionIds: Object.freeze([]),
    linkedSkillIds: Object.freeze(linkedSkillIds),
    updatedAtMs: skillsUpdated,
  });

  // 5. Daily Episodic Log Pages
  const episodicByDay = new Map<string, CoryMemoryItem[]>();
  for (const item of params.episodicItems) {
    const day = extractDateKeyFromEpisodicItem(item);
    const list = episodicByDay.get(day);
    if (list) {
      list.push(item);
    } else {
      episodicByDay.set(day, [item]);
    }
  }

  // Sort dates descending
  const sortedDays = Array.from(episodicByDay.keys()).sort().reverse();
  for (const day of sortedDays) {
    const dayItems = episodicByDay.get(day) ?? [];
    const dayUpdated =
      dayItems.length > 0
        ? Math.max(...dayItems.map((i) => i.updatedAt || i.createdAt || now))
        : now;
    const dayBody = dayItems
      .map((i) => {
        const sourceSuffix = i.source ? ` _(${i.source})_` : "";
        return `- ${i.content}${sourceSuffix}`;
      })
      .join("\n");

    const daySourceSessions = Array.from(
      new Set(
        dayItems
          .map((i) => i.source)
          .filter((src): src is string => typeof src === "string" && src.length > 0),
      ),
    );

    pages.push({
      slug: `daily-log-${day}`,
      title: `Daily Log — ${day}`,
      category: "daily_log",
      summary: `Episodic interaction log for ${day} (${dayItems.length} event(s)).`,
      markdownBody: `# Daily Log — ${day}\n\n${dayBody}\n`,
      sourceSessionIds: Object.freeze(daySourceSessions),
      linkedSkillIds: Object.freeze([]),
      updatedAtMs: dayUpdated,
    });
  }

  return Object.freeze(pages);
}

/**
 * Prepares zero-stall background compaction artifact:
 * - Pins the latest human user request so conversational objectives never get lost.
 * - Computes a deterministic SHA-256 hash of sorted unique tool names to maintain prompt-cache stability.
 * - Preserves all active safety constraints untouched.
 * - Generates a structured compact summary.
 */
export function prepareZeroStallCompaction(
  params: PrepareZeroStallCompactionParams,
): PreparedCompactionArtifact {
  // 1. Extract and pin latest user request
  let activeHumanRequest = "";
  for (let i = params.messages.length - 1; i >= 0; i--) {
    const msg = params.messages[i];
    if (msg && msg.role === "user" && msg.content.trim().length > 0) {
      activeHumanRequest = msg.content.trim();
      break;
    }
  }

  // If no user message was found, fallback to the last non-empty message or empty string
  if (!activeHumanRequest && params.messages.length > 0) {
    const lastMsg = params.messages[params.messages.length - 1];
    if (lastMsg?.content) {
      activeHumanRequest = lastMsg.content.trim();
    }
  }

  // 2. Deterministic SHA-256 hash of sorted unique tool names
  const sortedUniqueTools = Array.from(new Set(params.toolNames)).sort();
  const toolDefinitionsHash = crypto
    .createHash("sha256")
    .update(sortedUniqueTools.join(","))
    .digest("hex");

  // 3. Preserved constraints
  const preservedConstraints = Object.freeze([...params.activeConstraints]);

  // 4. Compacted summary
  const userMessages = params.messages.filter((m) => m.role === "user");
  const assistantMessages = params.messages.filter((m) => m.role === "assistant");
  const pinnedPreview =
    activeHumanRequest.length > 120 ? `${activeHumanRequest.slice(0, 117)}...` : activeHumanRequest;

  const compactedSummary =
    `Session ${params.sessionId}: ${params.messages.length} message(s) compacted ` +
    `(${userMessages.length} user, ${assistantMessages.length} assistant). ` +
    `Pinned active human request: "${pinnedPreview}". ` +
    `Preserved constraints: ${preservedConstraints.length}. Tools registered: ${sortedUniqueTools.length}.`;

  return Object.freeze({
    sessionId: params.sessionId,
    activeHumanRequest,
    toolDefinitionsHash,
    preservedConstraints,
    compactedSummary,
    preparedAtMs: Date.now(),
  });
}

// ============================================================================
// 3. OOP CoryKnowledgeScribeService (GatewayService)
// ============================================================================

export class CoryKnowledgeScribeService implements GatewayService {
  public readonly name = "cory-knowledge-scribe";

  private readonly cory: CoryBootstrapService;
  private readonly skillSynthesizer?: CorySkillSynthesizerService;
  private readonly wikiDir: string;
  private isStarted = false;

  private readonly stagedCompactions = new Map<string, PreparedCompactionArtifact>();

  constructor(options: CoryKnowledgeScribeServiceOptions) {
    this.cory = options.cory;
    this.skillSynthesizer = options.skillSynthesizer;
    this.wikiDir = options.wikiDir ?? path.join(this.cory.getStateDir(), "wiki");

    if (!fs.existsSync(this.wikiDir)) {
      try {
        fs.mkdirSync(this.wikiDir, { recursive: true });
      } catch {
        // will be created in start()
      }
    }
  }

  public getWikiDir(): string {
    return this.wikiDir;
  }

  public async start(): Promise<void> {
    if (!fs.existsSync(this.wikiDir)) {
      await fsPromises.mkdir(this.wikiDir, { recursive: true });
    }
    this.isStarted = true;
  }

  public async stop(): Promise<void> {
    this.isStarted = false;
    this.stagedCompactions.clear();
  }

  public health(): ServiceHealth {
    if (!this.isStarted) {
      return {
        status: "down",
        detail: "CoryKnowledgeScribeService is stopped.",
      };
    }
    return {
      status: "healthy",
      detail: `Knowledge Scribe active (wikiDir=${this.wikiDir}, stagedCompactions=${this.stagedCompactions.size})`,
    };
  }

  /**
   * Captures a reusable knowledge scribe note:
   * 1. Rejects Zone 0 (public channel or unauthenticated scope).
   * 2. Persists decisions and constraints into canonical memory.
   * 3. Writes a clean Markdown wiki page to `<wikiDir>/<slug>.md`.
   */
  public async captureScribeNote(params: CaptureScribeNoteParams): Promise<WikiTopicPage> {
    // 1. Zone 0 enforcement
    if (
      !isTrustedForDurablePromotion(params.scope) ||
      params.scope?.trustZone === "public" ||
      params.scope?.isPublicChannel === true
    ) {
      throw new Error("ZONE_0_BLOCKED: Public channels cannot mutate durable memory wiki pages.");
    }

    const category: WikiTopicCategory = params.category ?? "decisions";
    const slug = slugifyTitle(params.title);
    const now = Date.now();

    // 2. Persist decisions to durable layer
    if (params.decisions && params.decisions.length > 0) {
      for (const decision of params.decisions) {
        if (decision.trim().length > 0) {
          this.cory.memoryStore.remember({
            content: decision.trim(),
            layer: "durable",
            scope: params.scope,
            source: `scribe:${params.sessionId}`,
            tags: ["scribe", category],
          });
        }
      }
    }

    // 3. Persist constraints to constraint layer
    if (params.constraints && params.constraints.length > 0) {
      for (const constraint of params.constraints) {
        if (constraint.trim().length > 0) {
          this.cory.memoryStore.remember({
            content: constraint.trim(),
            layer: "constraint",
            scope: params.scope,
            source: `scribe:${params.sessionId}`,
            tags: ["scribe", "constraint"],
          });
        }
      }
    }

    // 4. Construct Markdown wiki page
    const insightsSection =
      params.insights.length > 0
        ? `## Key Insights\n${params.insights.map((i) => `- ${i}`).join("\n")}\n\n`
        : "";
    const decisionsSection =
      params.decisions && params.decisions.length > 0
        ? `## Architectural & Product Decisions\n${params.decisions.map((d) => `- ${d}`).join("\n")}\n\n`
        : "";
    const constraintsSection =
      params.constraints && params.constraints.length > 0
        ? `## Preserved Constraints\n${params.constraints.map((c) => `- ${c}`).join("\n")}\n\n`
        : "";

    const markdownBody =
      `---\n` +
      `slug: ${slug}\n` +
      `title: "${params.title.replace(/"/g, '\\"')}"\n` +
      `category: ${category}\n` +
      `sessionId: ${params.sessionId}\n` +
      `updatedAtMs: ${now}\n` +
      `---\n\n` +
      `# ${params.title}\n\n` +
      insightsSection +
      decisionsSection +
      constraintsSection;

    // 5. Write to disk
    if (!fs.existsSync(this.wikiDir)) {
      await fsPromises.mkdir(this.wikiDir, { recursive: true });
    }
    const filePath = path.join(this.wikiDir, `${slug}.md`);
    await fsPromises.writeFile(filePath, markdownBody, "utf-8");

    const page: WikiTopicPage = {
      slug,
      title: params.title,
      category,
      summary: params.insights.join("; ") || params.title,
      markdownBody,
      sourceSessionIds: Object.freeze([params.sessionId]),
      linkedSkillIds: Object.freeze([]),
      updatedAtMs: now,
    };

    return Object.freeze(page);
  }

  /**
   * Reads custom wiki pages written to disk in this.wikiDir.
   */
  private async loadDiskWikiPages(): Promise<readonly WikiTopicPage[]> {
    if (!fs.existsSync(this.wikiDir)) {
      return [];
    }
    const entries = await fsPromises.readdir(this.wikiDir, { withFileTypes: true });
    const pages: WikiTopicPage[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) {
        continue;
      }
      const filePath = path.join(this.wikiDir, entry.name);
      try {
        const rawContent = await fsPromises.readFile(filePath, "utf-8");
        const parsed = parseWikiMarkdownFile(entry.name, rawContent);
        if (parsed) {
          pages.push(parsed);
        }
      } catch {
        // skip unreadable files
      }
    }

    return pages;
  }

  /**
   * Retrieves the full Memory Wiki Snapshot:
   * - Compiles built-in topic pages from Cory memory layers and learned skills.
   * - Merges disk-persisted custom scribe pages.
   * - Provides audit panel showing exact paths to USER.md, MEMORY.md, and CONSTRAINTS.md.
   */
  public async getMemoryWikiSnapshot(scope?: CoryScope): Promise<MemoryWikiSnapshot> {
    const identityItems = this.cory.memoryStore.listLayerItems("identity", scope);
    const durableItems = this.cory.memoryStore.listLayerItems("durable", scope);
    const constraintItems = this.cory.memoryStore.listLayerItems("constraint", scope);
    const episodicItems = this.cory.memoryStore.listLayerItems("episodic", scope);

    let learnedSkills: readonly EvolvingSkillRecord[] = [];
    if (this.skillSynthesizer) {
      try {
        learnedSkills = await this.skillSynthesizer.listSkills();
      } catch {
        learnedSkills = [];
      }
    }

    const compiledPages = compileWikiTopicPagesFromCory({
      identityItems,
      durableItems,
      constraintItems,
      episodicItems,
      learnedSkills,
    });

    const diskPages = await this.loadDiskWikiPages();

    // Merge pages: disk pages take priority if slug matches, or append unique
    const pageMap = new Map<string, WikiTopicPage>();
    for (const page of compiledPages) {
      pageMap.set(page.slug, page);
    }
    for (const page of diskPages) {
      pageMap.set(page.slug, page);
    }

    const allPages = Array.from(pageMap.values());

    const userMdPath = this.cory.memoryStore.getIdentityFilePath(scope?.userScope);
    const memoryMdPath = this.cory.memoryStore.getDurableFilePath(
      scope?.workspaceId,
      scope?.workspaceDir,
    );
    const constraintsMdPath = this.cory.memoryStore.getConstraintsFilePath(scope?.workspaceId);

    return Object.freeze({
      pages: Object.freeze(allPages),
      auditPanel: {
        userMdPath,
        memoryMdPath,
        constraintsMdPath,
        totalPages: allPages.length,
      },
    });
  }

  /**
   * Stages a background-prepared compaction artifact.
   * Overwrites any prior staged compaction for this session.
   */
  public stagePreparedCompaction(
    params:
      | PreparedCompactionArtifact
      | {
          readonly sessionId: string;
          readonly messages: ReadonlyArray<{ readonly role: string; readonly content: string }>;
          readonly toolNames: readonly string[];
          readonly activeConstraints: readonly string[];
        },
  ): PreparedCompactionArtifact {
    let artifact: PreparedCompactionArtifact;
    if ("toolDefinitionsHash" in params && "activeHumanRequest" in params) {
      artifact = params;
    } else {
      artifact = prepareZeroStallCompaction(params);
    }

    this.stagedCompactions.set(artifact.sessionId, artifact);
    return artifact;
  }

  /**
   * Consumes and clears a prepared compaction artifact for a session.
   * Returns null if no artifact is staged.
   */
  public consumePreparedCompaction(sessionId: string): PreparedCompactionArtifact | null {
    const artifact = this.stagedCompactions.get(sessionId) ?? null;
    if (artifact) {
      this.stagedCompactions.delete(sessionId);
    }
    return artifact;
  }
}

// ============================================================================
// 4. Internal Markdown Parser for Disk Wiki Pages
// ============================================================================

function parseWikiMarkdownFile(filename: string, content: string): WikiTopicPage | null {
  const baseSlug = filename.replace(/\.md$/, "");
  let slug = baseSlug;
  let title = baseSlug;
  let category: WikiTopicCategory = "decisions";
  let sessionId = "";
  let updatedAtMs = Date.now();
  let body = content;

  // Simple frontmatter parsing
  if (content.startsWith("---")) {
    const endIdx = content.indexOf("\n---", 3);
    if (endIdx !== -1) {
      const frontmatter = content.slice(3, endIdx).trim();
      body = content.slice(endIdx + 4).trim();
      const lines = frontmatter.split("\n");
      for (const line of lines) {
        const colonIdx = line.indexOf(":");
        if (colonIdx === -1) continue;
        const key = line.slice(0, colonIdx).trim();
        const value = line
          .slice(colonIdx + 1)
          .trim()
          .replace(/^["']|["']$/g, "");
        if (key === "slug" && value) slug = value;
        if (key === "title" && value) title = value;
        if (
          key === "category" &&
          [
            "architecture",
            "decisions",
            "constraints",
            "workflows",
            "daily_log",
            "identity",
          ].includes(value)
        ) {
          category = value as WikiTopicCategory;
        }
        if (key === "sessionId" && value) sessionId = value;
        if (key === "updatedAtMs") {
          const parsedNum = Number(value);
          if (!Number.isNaN(parsedNum)) updatedAtMs = parsedNum;
        }
      }
    }
  }

  // If title was not in frontmatter, extract first markdown header
  if (title === baseSlug) {
    const headerMatch = body.match(/^#\s+(.+)$/m);
    if (headerMatch?.[1]) {
      title = headerMatch[1].trim();
    }
  }

  // Extract a brief summary from body
  const bodyLines = body.split("\n").filter((l) => l.trim().length > 0 && !l.startsWith("#"));
  const firstLine = bodyLines[0] ?? title;
  const summary = firstLine.replace(/^[->*\s]+/, "").slice(0, 160);

  return {
    slug,
    title,
    category,
    summary,
    markdownBody: content,
    sourceSessionIds: sessionId ? Object.freeze([sessionId]) : Object.freeze([]),
    linkedSkillIds: Object.freeze([]),
    updatedAtMs,
  };
}
