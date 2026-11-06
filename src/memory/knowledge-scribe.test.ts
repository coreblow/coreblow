/**
 * CoreBlow — Cory Knowledge Scribe & Memory Wiki Unit Test Suite
 *
 * Validates all Milestone 1 requirements:
 * 1. Pure DOP Contracts: WikiTopicPage, PreparedCompactionArtifact
 * 2. Pure DOP Functions: compileWikiTopicPagesFromCory, prepareZeroStallCompaction
 * 3. OOP CoryKnowledgeScribeService: GatewayService lifecycle, Zone 0 rejection,
 *    persisting decisions/constraints, writing wiki markdown files, audit panel,
 *    and background compaction staging & consumption.
 * 4. Re-export integrity from src/memory/index.ts and src/plugin-sdk/memory.ts.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { EvolvingSkillRecord, SkillFitnessMetrics } from "../learning/dop-skill-distiller.js";
import * as PluginSdkMemory from "../plugin-sdk/memory.js";
import {
  CoryBootstrapService,
  CoryKnowledgeScribeService,
  type CoryMemoryItem,
  type CoryScope,
  compileWikiTopicPagesFromCory,
  prepareZeroStallCompaction,
  slugifyTitle,
} from "./index.js";

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-scribe-test-"));
}

function cleanupTempDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}

describe("Cory Knowledge Scribe & Browsable Memory Wiki (Milestone 1)", () => {
  let tmpDir: string;
  let cory: CoryBootstrapService;
  let scribeService: CoryKnowledgeScribeService;

  beforeEach(async () => {
    tmpDir = createTempDir();
    cory = new CoryBootstrapService({ stateDir: path.join(tmpDir, "cory") });
    await cory.start();

    scribeService = new CoryKnowledgeScribeService({
      cory,
      wikiDir: path.join(tmpDir, "wiki"),
    });
    await scribeService.start();
  });

  afterEach(async () => {
    await scribeService.stop();
    await cory.stop();
    cleanupTempDir(tmpDir);
  });

  // -------------------------------------------------------------------------
  // 1. Pure DOP Transformation: compileWikiTopicPagesFromCory
  // -------------------------------------------------------------------------

  describe("compileWikiTopicPagesFromCory", () => {
    it("compiles standard 4 topic pages when memory items and skills are empty", () => {
      const pages = compileWikiTopicPagesFromCory({
        identityItems: [],
        durableItems: [],
        constraintItems: [],
        episodicItems: [],
        learnedSkills: [],
      });

      expect(pages).toHaveLength(4);
      const slugs = pages.map((p) => p.slug);
      expect(slugs).toEqual([
        "identity-overview",
        "architecture-decisions",
        "active-constraints",
        "learned-skills-catalog",
      ]);

      const identityPage = pages.find((p) => p.slug === "identity-overview");
      expect(identityPage?.category).toBe("identity");
      expect(identityPage?.title).toBe("Identity & User Profile Overview");
      expect(identityPage?.sourceSessionIds).toHaveLength(0);
      expect(identityPage?.linkedSkillIds).toHaveLength(0);

      const decisionPage = pages.find((p) => p.slug === "architecture-decisions");
      expect(decisionPage?.category).toBe("decisions");
      expect(decisionPage?.title).toBe("Architecture & Durable Decisions");

      const constraintPage = pages.find((p) => p.slug === "active-constraints");
      expect(constraintPage?.category).toBe("constraints");
      expect(constraintPage?.title).toBe("Active Invariants & Hard Constraints");

      const skillsPage = pages.find((p) => p.slug === "learned-skills-catalog");
      expect(skillsPage?.category).toBe("workflows");
      expect(skillsPage?.linkedSkillIds).toHaveLength(0);
    });

    it("transforms items across all layers and compiles daily episodic log pages without mutation", () => {
      const now = Date.now();
      const identityItems: readonly CoryMemoryItem[] = [
        {
          id: "id-1",
          layer: "identity",
          content: "Prefers concise TypeScript snippets",
          userScope: "default",
          workspaceId: "default",
          createdAt: now - 5000,
          updatedAt: now - 5000,
          tags: ["preference", "coding"],
          source: "session-101",
        },
      ];

      const durableItems: readonly CoryMemoryItem[] = [
        {
          id: "dur-1",
          layer: "durable",
          content: "Use hybrid OOP microkernel with pure DOP algorithms",
          userScope: "default",
          workspaceId: "default",
          createdAt: now - 4000,
          updatedAt: now - 4000,
          tags: ["architecture", "kernel"],
          source: "session-102",
        },
      ];

      const constraintItems: readonly CoryMemoryItem[] = [
        {
          id: "con-1",
          layer: "constraint",
          content: "Brand Sovereignty: Never output competitor naming",
          userScope: "default",
          workspaceId: "default",
          createdAt: now - 3000,
          updatedAt: now - 3000,
          tags: ["safety", "brand"],
          immutableConstraint: true,
          source: "session-103",
        },
      ];

      const episodicItems: readonly CoryMemoryItem[] = [
        {
          id: "epi-1",
          layer: "episodic",
          content: "Benchmarked vitest test performance",
          userScope: "default",
          workspaceId: "default",
          createdAt: new Date("2026-11-05T10:00:00Z").getTime(),
          updatedAt: new Date("2026-11-05T10:00:00Z").getTime(),
          tags: ["benchmark"],
          source: "daily/2026-11-05.md",
        },
        {
          id: "epi-2",
          layer: "episodic",
          content: "Verified zero-stall background compaction",
          userScope: "default",
          workspaceId: "default",
          createdAt: new Date("2026-11-06T08:00:00Z").getTime(),
          updatedAt: new Date("2026-11-06T08:00:00Z").getTime(),
          tags: ["verification"],
          source: "daily/2026-11-06.md",
        },
      ];
      const mockFitness: SkillFitnessMetrics = {
        invocations: 10,
        successes: 10,
        failures: 0,
        consecutiveFailures: 0,
        wilsonScore: 0.95,
        avgTurnsSaved: 2,
        lastVerifiedAt: new Date(now).toISOString(),
        totalInvocations: 10,
        successfulInvocations: 10,
        failedInvocations: 0,
        lastUpdatedMs: now,
      };

      const mockSkills: readonly EvolvingSkillRecord[] = [
        {
          id: "skill-rag-1",
          name: "rag-retrieval-optimizer",
          title: "RAG Retrieval Optimizer",
          slug: "rag-retrieval-optimizer",
          version: "1.0.0",
          description: "Optimizes hybrid lexical and vector search scores",
          status: "verified_active",
          category: "retrieval",
          triggers: ["semantic search", "rag query"],
          tools: ["hybrid_search"],
          whenToUse: "When searching memory databases",
          verifiedProcedure: ["1. query BM25", "2. query vector", "3. rerank"],
          executionStrategy: ["direct"],
          pitfallsAndConstraints: ["respect quota limits"],
          pitfallsConstraints: ["respect quota limits"],
          verificationGate: "vitest",
          verificationCriteria: ["top-1 accuracy > 0.9"],
          fitness: mockFitness,
          metrics: mockFitness,
          workspaceId: "default",
          createdAtMs: now - 2000,
          updatedAt: now - 1000,
          updatedAtMs: now - 1000,
          locked: true,
        },
      ];

      const pages = compileWikiTopicPagesFromCory({
        identityItems,
        durableItems,
        constraintItems,
        episodicItems,
        learnedSkills: mockSkills,
      });

      // 4 base pages + 2 daily log pages (2026-11-06 and 2026-11-05) = 6 pages
      expect(pages).toHaveLength(6);

      const identityPage = pages.find((p) => p.slug === "identity-overview");
      expect(identityPage?.markdownBody).toContain("Prefers concise TypeScript snippets");
      expect(identityPage?.sourceSessionIds).toContain("session-101");

      const durablePage = pages.find((p) => p.slug === "architecture-decisions");
      expect(durablePage?.markdownBody).toContain("hybrid OOP microkernel");
      expect(durablePage?.sourceSessionIds).toContain("session-102");

      const constraintPage = pages.find((p) => p.slug === "active-constraints");
      expect(constraintPage?.markdownBody).toContain("Brand Sovereignty");
      expect(constraintPage?.markdownBody).toContain("(immutable)");

      const skillsPage = pages.find((p) => p.slug === "learned-skills-catalog");
      expect(skillsPage?.linkedSkillIds).toContain("skill-rag-1");
      expect(skillsPage?.markdownBody).toContain("RAG Retrieval Optimizer 🔒");
      expect(skillsPage?.markdownBody).toContain("hybrid_search");

      // Daily log pages sorted descending
      const dailyPages = pages.filter((p) => p.category === "daily_log");
      expect(dailyPages).toHaveLength(2);
      expect(dailyPages[0]?.slug).toBe("daily-log-2026-11-06");
      expect(dailyPages[1]?.slug).toBe("daily-log-2026-11-05");
      expect(dailyPages[0]?.markdownBody).toContain("Verified zero-stall background compaction");
      expect(dailyPages[1]?.markdownBody).toContain("Benchmarked vitest test performance");

      // Zero mutation check
      expect(identityItems).toHaveLength(1);
      expect(durableItems).toHaveLength(1);
      expect(constraintItems).toHaveLength(1);
      expect(episodicItems).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Pure DOP Compaction: prepareZeroStallCompaction
  // -------------------------------------------------------------------------

  describe("prepareZeroStallCompaction", () => {
    it("pins the latest active human request and generates deterministic tool hash", () => {
      const messages = [
        { role: "system", content: "You are CoreBlow's autonomous assistant." },
        { role: "user", content: "Build the memory wiki engine." },
        { role: "assistant", content: "I am starting implementation now." },
        { role: "tool", content: "file created: src/memory/knowledge-scribe.ts" },
        { role: "assistant", content: "Code written." },
        { role: "user", content: "Please run unit tests and verify zero-stall compaction." },
        { role: "assistant", content: "Running vitest now..." },
      ];

      const toolNames = ["run_command", "view_file", "replace_file_content", "view_file"];
      const activeConstraints = [
        "Brand Sovereignty: Zero competitor names",
        "Non-interactive shell: use COREPACK_ENABLE_DOWNLOAD_PROMPT=0",
      ];

      const artifact = prepareZeroStallCompaction({
        sessionId: "sess-abc-123",
        messages,
        toolNames,
        activeConstraints,
      });

      expect(artifact.sessionId).toBe("sess-abc-123");
      expect(artifact.activeHumanRequest).toBe(
        "Please run unit tests and verify zero-stall compaction.",
      );
      expect(artifact.preservedConstraints).toEqual(activeConstraints);
      expect(artifact.toolDefinitionsHash).toMatch(/^[a-f0-9]{64}$/);

      // Verify deterministic tool hashing: order-independent and deduplicated
      const permutedArtifact = prepareZeroStallCompaction({
        sessionId: "sess-abc-123",
        messages,
        toolNames: ["view_file", "replace_file_content", "run_command"], // different order & no duplicate
        activeConstraints,
      });

      expect(artifact.toolDefinitionsHash).toBe(permutedArtifact.toolDefinitionsHash);
      expect(artifact.compactedSummary).toContain("7 message(s) compacted");
      expect(artifact.compactedSummary).toContain("Please run unit tests");
    });

    it("handles sessions with no user messages gracefully", () => {
      const messages = [{ role: "system", content: "Background daemon initialized." }];

      const artifact = prepareZeroStallCompaction({
        sessionId: "daemon-sess-1",
        messages,
        toolNames: ["system_ping"],
        activeConstraints: [],
      });

      expect(artifact.activeHumanRequest).toBe("Background daemon initialized.");
      expect(artifact.toolDefinitionsHash).toMatch(/^[a-f0-9]{64}$/);
      expect(artifact.preservedConstraints).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // 3. OOP GatewayService: CoryKnowledgeScribeService
  // -------------------------------------------------------------------------

  describe("CoryKnowledgeScribeService", () => {
    it("reports correct GatewayService lifecycle and health", async () => {
      expect(scribeService.name).toBe("cory-knowledge-scribe");
      expect(scribeService.health().status).toBe("healthy");
      expect(scribeService.health().detail).toContain("wikiDir=");

      await scribeService.stop();
      expect(scribeService.health().status).toBe("down");

      await scribeService.start();
      expect(scribeService.health().status).toBe("healthy");
    });

    it("rejects Zone 0 public channels from capturing scribe notes (ZONE_0_BLOCKED)", async () => {
      const publicScope: CoryScope = {
        trustZone: "public",
        isPublicChannel: true,
      };

      await expect(
        scribeService.captureScribeNote({
          sessionId: "untrusted-sess-1",
          title: "Public Proposal",
          insights: ["Public users want feature X"],
          decisions: ["Adopt feature X"],
          constraints: ["Do not allow public mutation"],
          scope: publicScope,
        }),
      ).rejects.toThrow(/ZONE_0_BLOCKED/);

      // Verify that no durable memories were persisted
      const durableItems = cory.memoryStore.listLayerItems("durable", publicScope);
      expect(durableItems.find((i) => i.content.includes("Adopt feature X"))).toBeUndefined();

      // Verify no wiki file was created
      const wikiDir = scribeService.getWikiDir();
      const files = fs.readdirSync(wikiDir);
      expect(files.filter((f) => f.includes("public-proposal"))).toHaveLength(0);
    });

    it("captures scribe notes in authenticated scope, persisting to memory layers and writing markdown files", async () => {
      const authenticatedScope: CoryScope = {
        trustZone: "authenticated",
        userScope: "architect-lead",
        workspaceId: "coreblow-main",
      };

      const page = await scribeService.captureScribeNote({
        sessionId: "arch-review-42",
        title: "Stage 7 Microkernel Architecture",
        category: "architecture",
        insights: [
          "Zero-stall compaction preserves prompt cache prefixes",
          "Browsable Memory Wiki provides instant auditing",
        ],
        decisions: ["Register cory-knowledge-scribe as Tier-2 GatewayService"],
        constraints: ["Keep memory mutations locked down to authenticated and operator zones"],
        scope: authenticatedScope,
      });

      expect(page.slug).toBe("stage-7-microkernel-architecture");
      expect(page.title).toBe("Stage 7 Microkernel Architecture");
      expect(page.category).toBe("architecture");
      expect(page.sourceSessionIds).toContain("arch-review-42");

      // Verify file written to disk
      const wikiFilePath = path.join(
        scribeService.getWikiDir(),
        "stage-7-microkernel-architecture.md",
      );
      expect(fs.existsSync(wikiFilePath)).toBe(true);
      const fileContent = fs.readFileSync(wikiFilePath, "utf-8");
      expect(fileContent).toContain("slug: stage-7-microkernel-architecture");
      expect(fileContent).toContain("Register cory-knowledge-scribe as Tier-2 GatewayService");

      // Verify persistence in Cory memory store
      const durable = cory.memoryStore.listLayerItems("durable", authenticatedScope);
      expect(durable.some((d) => d.content.includes("Register cory-knowledge-scribe"))).toBe(true);

      const constraints = cory.memoryStore.listLayerItems("constraint", authenticatedScope);
      expect(constraints.some((c) => c.content.includes("Keep memory mutations locked down"))).toBe(
        true,
      );
    });

    it("provides complete MemoryWikiSnapshot with audit panel paths and merged disk pages", async () => {
      const scope: CoryScope = {
        userScope: "test-user",
        workspaceId: "test-ws",
      };

      // Add a durable memory and an identity preference directly
      cory.memoryStore.remember({
        content: "High-contrast dark mode preferred",
        layer: "identity",
        scope,
      });
      cory.memoryStore.remember({
        content: "Use pnpm for dependency management",
        layer: "durable",
        scope,
      });

      // Capture a scribe note
      await scribeService.captureScribeNote({
        sessionId: "note-session-1",
        title: "Test Engineering Protocol",
        category: "workflows",
        insights: ["Unit tests must run in < 15 seconds"],
        decisions: ["Use vitest with forks pool"],
        scope,
      });

      const snapshot = await scribeService.getMemoryWikiSnapshot(scope);

      expect(snapshot.pages.length).toBeGreaterThanOrEqual(5);
      const slugs = snapshot.pages.map((p) => p.slug);
      expect(slugs).toContain("identity-overview");
      expect(slugs).toContain("architecture-decisions");
      expect(slugs).toContain("active-constraints");
      expect(slugs).toContain("learned-skills-catalog");
      expect(slugs).toContain("test-engineering-protocol");

      // Verify audit panel
      expect(snapshot.auditPanel.userMdPath).toContain("USER.md");
      expect(snapshot.auditPanel.memoryMdPath).toContain("MEMORY.md");
      expect(snapshot.auditPanel.constraintsMdPath).toContain("CONSTRAINTS.md");
      expect(snapshot.auditPanel.totalPages).toBe(snapshot.pages.length);
    });

    it("stages and consumes background compaction artifacts per session", () => {
      const sessionId = "session-compaction-99";
      const messages = [
        { role: "user", content: "Optimize database indexes." },
        { role: "assistant", content: "Added composite index on (layer, scope)." },
      ];
      const toolNames = ["sqlite_query", "explain_query_plan"];
      const activeConstraints = ["Preserve backward compatibility"];

      // Stage compaction
      const staged = scribeService.stagePreparedCompaction({
        sessionId,
        messages,
        toolNames,
        activeConstraints,
      });

      expect(staged.sessionId).toBe(sessionId);
      expect(staged.activeHumanRequest).toBe("Optimize database indexes.");

      // Consume compaction
      const consumed = scribeService.consumePreparedCompaction(sessionId);
      expect(consumed).toEqual(staged);

      // Verify single consumption (subsequent call returns null)
      const secondConsume = scribeService.consumePreparedCompaction(sessionId);
      expect(secondConsume).toBeNull();

      // Consuming non-existent session returns null
      expect(scribeService.consumePreparedCompaction("non-existent-session")).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 4. Helper Function Tests
  // -------------------------------------------------------------------------

  describe("slugifyTitle helper", () => {
    it("generates clean, URL-safe and filesystem-safe slugs", () => {
      expect(slugifyTitle("Hello World! 2026")).toBe("hello-world-2026");
      expect(slugifyTitle("  Multiple   Spaces & Special#Characters  ")).toBe(
        "multiple-spaces-special-characters",
      );
      expect(slugifyTitle("")).toBe("topic");
      expect(slugifyTitle("---Leading and trailing dashes---")).toBe("leading-and-trailing-dashes");
    });
  });

  // -------------------------------------------------------------------------
  // 5. Plugin SDK Re-export Certification
  // -------------------------------------------------------------------------

  describe("Plugin SDK Re-export Certification", () => {
    it("exports all Knowledge Scribe contracts and services through plugin-sdk/memory", () => {
      expect(typeof PluginSdkMemory.CoryKnowledgeScribeService).toBe("function");
      expect(typeof PluginSdkMemory.compileWikiTopicPagesFromCory).toBe("function");
      expect(typeof PluginSdkMemory.prepareZeroStallCompaction).toBe("function");
      expect(typeof PluginSdkMemory.slugifyTitle).toBe("function");
    });
  });
});
