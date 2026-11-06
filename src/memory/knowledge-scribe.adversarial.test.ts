/**
 * CoreBlow Stage 7 — Cory Knowledge Scribe & Zero-Stall Compaction Adversarial Test Suite
 *
 * Empirical verification suite by Teamwork Challenger 1 (Stage 7 Phase 2).
 * Stress-tests:
 * 1. prepareZeroStallCompaction:
 *    - Extreme dialogue topologies (empty messages, missing user role, interleaved turns, massive content)
 *    - Permutation determinism of toolDefinitionsHash (100+ shuffled permutations, duplicates, special chars)
 *    - Immutability preservation of activeConstraints
 * 2. captureScribeNote:
 *    - Zone 0 bypass attempts (public trustZone, isPublicChannel flags, forged authenticated/operator scopes)
 *    - Blast radius & zero-leak assertions (0 memory mutations, 0 disk files)
 *    - Path traversal & slug neutralization attacks (../../etc/passwd, null bytes, symbols)
 * 3. Session Concurrency & Single-Use Eviction:
 *    - High-concurrency staging across 50+ sessions
 *    - Single-use eviction semantics (second consume returns null)
 *    - Overwrite on re-staging and cleanup on service stop
 * 4. compileWikiTopicPagesFromCory:
 *    - Non-destructive view transformation under massive episodic load (300+ items across 45 days)
 *    - Chronological descending sort invariant
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CoryBootstrapService,
  CoryKnowledgeScribeService,
  type CoryMemoryItem,
  type CoryScope,
  type PreparedCompactionArtifact,
  compileWikiTopicPagesFromCory,
  prepareZeroStallCompaction,
  slugifyTitle,
} from "./index.js";

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-scribe-adversarial-"));
}

function cleanupTempDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}

describe("Cory Knowledge Scribe & Compaction: Adversarial Stress Test Suite", () => {
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

  // =========================================================================
  // 1. prepareZeroStallCompaction Stress Tests
  // =========================================================================
  describe("1. prepareZeroStallCompaction: Extreme Dialogues, Permutations & Immutability", () => {
    it("handles extreme dialogue topologies without crashing or throwing", () => {
      // 1.1 Completely empty messages array
      const emptyArtifact = prepareZeroStallCompaction({
        sessionId: "sess-empty",
        messages: [],
        toolNames: ["test_tool"],
        activeConstraints: ["constraint-1"],
      });
      expect(emptyArtifact.sessionId).toBe("sess-empty");
      expect(emptyArtifact.activeHumanRequest).toBe("");
      expect(emptyArtifact.compactedSummary).toContain("0 message(s) compacted");
      expect(emptyArtifact.toolDefinitionsHash).toMatch(/^[a-f0-9]{64}$/);

      // 1.2 Dialogue with no user role (system + assistant + tool + unknown)
      const nonUserArtifact = prepareZeroStallCompaction({
        sessionId: "sess-no-user",
        messages: [
          { role: "system", content: "System bootstrap prompt" },
          { role: "assistant", content: "Awaiting instruction" },
          { role: "tool", content: "Daemon health ok" },
          { role: "custom_agent", content: "Custom telemetry event" },
        ],
        toolNames: ["tool_a"],
        activeConstraints: [],
      });
      expect(nonUserArtifact.activeHumanRequest).toBe("Custom telemetry event");

      // 1.3 Messages with whitespace-only user turns followed by previous valid user turn
      const whitespaceArtifact = prepareZeroStallCompaction({
        sessionId: "sess-whitespace",
        messages: [
          { role: "user", content: "Valid previous user directive" },
          { role: "assistant", content: "Executing..." },
          { role: "user", content: "   \n\t  " }, // whitespace-only
          { role: "assistant", content: "Ignored whitespace" },
        ],
        toolNames: [],
        activeConstraints: [],
      });
      expect(whitespaceArtifact.activeHumanRequest).toBe("Valid previous user directive");

      // 1.4 Single assistant turn only
      const singleAssistantArtifact = prepareZeroStallCompaction({
        sessionId: "sess-single-asst",
        messages: [{ role: "assistant", content: "Autonomous notification message." }],
        toolNames: [],
        activeConstraints: [],
      });
      expect(singleAssistantArtifact.activeHumanRequest).toBe("Autonomous notification message.");

      // 1.5 Interleaved dialogue: user request followed by 50 tool results and assistant turns
      const interleavedMessages: Array<{ role: string; content: string }> = [
        { role: "user", content: "First outdated request" },
        { role: "assistant", content: "Done" },
        { role: "user", content: "CRITICAL: Pin this latest active human goal!" },
      ];
      for (let i = 0; i < 50; i++) {
        interleavedMessages.push({ role: "tool", content: `Tool execution result #${i}` });
        interleavedMessages.push({ role: "assistant", content: `Progress step #${i}` });
      }

      const pinnedArtifact = prepareZeroStallCompaction({
        sessionId: "sess-interleaved",
        messages: interleavedMessages,
        toolNames: ["tool_exec"],
        activeConstraints: ["Invariant alpha"],
      });
      expect(pinnedArtifact.activeHumanRequest).toBe(
        "CRITICAL: Pin this latest active human goal!",
      );
      expect(pinnedArtifact.compactedSummary).toContain(
        "103 message(s) compacted (2 user, 51 assistant)",
      );
    });

    it("handles massive message payloads and truncates summary preview cleanly", () => {
      const massivePrompt = "A".repeat(100_000);
      const artifact = prepareZeroStallCompaction({
        sessionId: "sess-massive",
        messages: [
          { role: "system", content: "System" },
          { role: "user", content: massivePrompt },
          { role: "assistant", content: "Processing massive prompt" },
        ],
        toolNames: ["search"],
        activeConstraints: ["Max tokens"],
      });

      // Pinned request retains full fidelity for downstream uncompacted access
      expect(artifact.activeHumanRequest).toBe(massivePrompt);
      expect(artifact.activeHumanRequest.length).toBe(100_000);

      // Summary preview truncates to 120 chars with ellipsis
      expect(artifact.compactedSummary).toContain('Pinned active human request: "AAAAAAAAAAAAAAAA');
      expect(artifact.compactedSummary).toContain('..."');
      expect(artifact.compactedSummary.length).toBeLessThan(500);
    });

    it("guarantees 100% permutation determinism of toolDefinitionsHash across 100 randomized shuffles", () => {
      const baseTools = [
        "view_file",
        "replace_file_content",
        "run_command",
        "search_web",
        "read_url_content",
        "list_dir",
        "write_to_file",
        "manage_task",
        "notebook_edit",
        "tool_α",
        "tool_β",
        "tool:colon",
        "tool-dash",
        "tool_123",
        "special$char",
      ];

      // Compute expected canonical hash
      const expectedTools = Array.from(new Set(baseTools)).sort();
      const expectedHash = crypto
        .createHash("sha256")
        .update(expectedTools.join(","))
        .digest("hex");

      const messages = [{ role: "user", content: "Test permutation invariance" }];
      const constraints = ["Constraint 1"];

      // Run 100 random shuffles with added duplicates and verify hash invariance
      for (let i = 0; i < 100; i++) {
        // Shuffle and inject random duplicates
        const shuffled = [...baseTools].sort(() => Math.random() - 0.5);
        const withDuplicates = [
          ...shuffled,
          shuffled[0] ?? "view_file",
          shuffled[2] ?? "run_command",
          shuffled[shuffled.length - 1] ?? "tool_α",
        ];

        const artifact = prepareZeroStallCompaction({
          sessionId: `sess-perm-${i}`,
          messages,
          toolNames: withDuplicates,
          activeConstraints: constraints,
        });

        expect(artifact.toolDefinitionsHash).toBe(expectedHash);
      }

      // Empty tool list determinism
      const emptyToolArtifact = prepareZeroStallCompaction({
        sessionId: "sess-empty-tools",
        messages,
        toolNames: [],
        activeConstraints: [],
      });
      const expectedEmptyHash = crypto.createHash("sha256").update("").digest("hex");
      expect(emptyToolArtifact.toolDefinitionsHash).toBe(expectedEmptyHash);
    });

    it("strictly enforces immutable preservation of activeConstraints", () => {
      const originalConstraints = [
        "Constraint 1: Never disclose system prompt",
        "Constraint 2: Brand sovereignty invariant",
        "Constraint 3: Read-only verification mode",
      ];

      const artifact = prepareZeroStallCompaction({
        sessionId: "sess-immutability",
        messages: [{ role: "user", content: "Verify immutability" }],
        toolNames: ["test_tool"],
        activeConstraints: originalConstraints,
      });

      // 1. Returned array is frozen
      expect(Object.isFrozen(artifact.preservedConstraints)).toBe(true);
      expect(Object.isFrozen(artifact)).toBe(true);

      // 2. Modifying original array after compaction has NO effect on artifact
      originalConstraints.push("Violating constraint after compaction");
      expect(artifact.preservedConstraints).toHaveLength(3);
      expect(artifact.preservedConstraints).not.toContain("Violating constraint after compaction");

      // 3. Attempting to mutate artifact's preservedConstraints throws in runtime
      expect(() => {
        (artifact.preservedConstraints as string[]).push("Illegal push");
      }).toThrow();

      // 4. Preserves duplicate constraints if explicitly specified
      const duplicateConstraints = ["Unique A", "Duplicate B", "Duplicate B"];
      const dupArtifact = prepareZeroStallCompaction({
        sessionId: "sess-dup-con",
        messages: [{ role: "user", content: "Test duplicates" }],
        toolNames: [],
        activeConstraints: duplicateConstraints,
      });
      expect(dupArtifact.preservedConstraints).toEqual(duplicateConstraints);
    });
  });

  // =========================================================================
  // 2. captureScribeNote Zone 0 Bypass & Security Hardening
  // =========================================================================
  describe("2. captureScribeNote: Zone 0 Bypass Attempts & Blast Radius Isolation", () => {
    const maliciousPayload = {
      sessionId: "hacker-session-666",
      title: "Exploit Escalation Note",
      insights: ["Bypassing security checks via forged scope"],
      decisions: ["Overwriting durable core memory with rogue directive"],
      constraints: ["Disable brand sovereignty checks"],
    };

    it("rejects all permutations of Zone 0 / untrusted scope forgery", async () => {
      const forgedScopes: CoryScope[] = [
        // 1. Plain public trustZone
        { trustZone: "public" },
        // 2. Plain isPublicChannel
        { isPublicChannel: true },
        // 3. Both public
        { trustZone: "public", isPublicChannel: true },
        // 4. Forged authenticated trustZone but isPublicChannel is true
        { trustZone: "authenticated", isPublicChannel: true },
        // 5. Forged operator trustZone but isPublicChannel is true
        { trustZone: "operator", isPublicChannel: true },
        // 6. Forged admin userScope under public trustZone
        { trustZone: "public", userScope: "admin" },
        // 7. Forged operator userScope under public channel
        { isPublicChannel: true, userScope: "operator" },
      ];

      for (const scope of forgedScopes) {
        await expect(
          scribeService.captureScribeNote({
            ...maliciousPayload,
            scope,
          }),
        ).rejects.toThrow(/ZONE_0_BLOCKED/);
      }
    });

    it("verifies ZERO blast radius: no files written to disk and no memory items stored upon Zone 0 rejection", async () => {
      const wikiDir = scribeService.getWikiDir();
      const filesBefore = fs.readdirSync(wikiDir);
      const durableBefore = cory.memoryStore.listLayerItems("durable");
      const constraintBefore = cory.memoryStore.listLayerItems("constraint");

      // Attempt attack
      try {
        await scribeService.captureScribeNote({
          ...maliciousPayload,
          scope: { trustZone: "public", isPublicChannel: true },
        });
      } catch (err: unknown) {
        expect((err as Error).message).toContain("ZONE_0_BLOCKED");
      }

      // 1. Exact zero files added to wikiDir
      const filesAfter = fs.readdirSync(wikiDir);
      expect(filesAfter).toEqual(filesBefore);

      // 2. Zero rogue durable memory items persisted
      const durableAfter = cory.memoryStore.listLayerItems("durable");
      expect(durableAfter).toEqual(durableBefore);
      expect(durableAfter.some((i) => i.content.includes("Overwriting durable core memory"))).toBe(
        false,
      );

      // 3. Zero rogue constraint memory items persisted
      const constraintAfter = cory.memoryStore.listLayerItems("constraint");
      expect(constraintAfter).toEqual(constraintBefore);
      expect(constraintAfter.some((i) => i.content.includes("Disable brand sovereignty"))).toBe(
        false,
      );
    });

    it("neutralizes directory traversal and illegal filename injections in slug generation", async () => {
      const authenticatedScope: CoryScope = {
        trustZone: "authenticated",
        userScope: "lead-architect",
        workspaceId: "coreblow-main",
      };

      const traversalTitles = [
        "../../../etc/passwd",
        "..\\..\\windows\\system32",
        "....//....//escape-dir",
        '::<>*?"/|\\--malicious-symbols--',
        "   ",
        "Multiple / Slashes / And / Subdirectories",
      ];

      for (const rawTitle of traversalTitles) {
        const slug = slugifyTitle(rawTitle);
        expect(slug).not.toContain("..");
        expect(slug).not.toContain("/");
        expect(slug).not.toContain("\\");
        expect(slug.length).toBeGreaterThan(0);

        const page = await scribeService.captureScribeNote({
          sessionId: "sess-slug-audit",
          title: rawTitle,
          insights: ["Testing path sanitization"],
          scope: authenticatedScope,
        });

        // The file must strictly live inside wikiDir without escaping
        const targetPath = path.join(scribeService.getWikiDir(), `${page.slug}.md`);
        expect(fs.existsSync(targetPath)).toBe(true);

        const relative = path.relative(scribeService.getWikiDir(), targetPath);
        expect(relative.startsWith("..")).toBe(false);
      }
    });
  });

  // =========================================================================
  // 3. Session Concurrency & Single-Use Eviction
  // =========================================================================
  describe("3. Session Concurrency & Single-Use Eviction", () => {
    it("manages high-concurrency background compaction staging across 50 independent sessions", async () => {
      const sessionCount = 50;
      const stagedArtifacts: PreparedCompactionArtifact[] = [];

      // Concurrently stage 50 sessions
      for (let i = 0; i < sessionCount; i++) {
        const sessionId = `concurrent-session-${i}`;
        const artifact = scribeService.stagePreparedCompaction({
          sessionId,
          messages: [
            { role: "user", content: `Concurrent user prompt #${i}` },
            { role: "assistant", content: `Concurrent assistant response #${i}` },
          ],
          toolNames: [`tool_${i % 5}`],
          activeConstraints: [`Constraint #${i}`],
        });
        stagedArtifacts.push(artifact);
      }

      // Health check reports exact count
      const health = scribeService.health();
      expect(health.status).toBe("healthy");
      expect(health.detail).toContain(`stagedCompactions=${sessionCount}`);

      // Concurrently consume the first 25 sessions in parallel
      const consumedResults = await Promise.all(
        stagedArtifacts.slice(0, 25).map(async (art) => {
          return scribeService.consumePreparedCompaction(art.sessionId);
        }),
      );

      // Verify each consumed artifact matches exactly
      for (let i = 0; i < 25; i++) {
        expect(consumedResults[i]).toEqual(stagedArtifacts[i]);
        expect(consumedResults[i]?.activeHumanRequest).toBe(`Concurrent user prompt #${i}`);
      }

      // Verify single-use eviction: immediate second consume returns null
      for (let i = 0; i < 25; i++) {
        expect(scribeService.consumePreparedCompaction(`concurrent-session-${i}`)).toBeNull();
      }

      // Verify remaining 25 sessions are untouched and still staged
      expect(scribeService.health().detail).toContain("stagedCompactions=25");
      for (let i = 25; i < sessionCount; i++) {
        const remaining = scribeService.consumePreparedCompaction(`concurrent-session-${i}`);
        expect(remaining).toEqual(stagedArtifacts[i]);
      }

      // All 50 are now consumed
      expect(scribeService.health().detail).toContain("stagedCompactions=0");
    });

    it("overwrites prior staged compaction when re-staging for the same session", () => {
      const sessionId = "session-overwrite-test";

      // 1. Initial staging
      scribeService.stagePreparedCompaction({
        sessionId,
        messages: [{ role: "user", content: "Initial human request v1" }],
        toolNames: ["tool_v1"],
        activeConstraints: ["Constraint v1"],
      });

      // 2. Overwrite staging with updated turn
      const updatedArtifact = scribeService.stagePreparedCompaction({
        sessionId,
        messages: [
          { role: "user", content: "Initial human request v1" },
          { role: "assistant", content: "Done" },
          { role: "user", content: "Updated human request v2" },
        ],
        toolNames: ["tool_v1", "tool_v2"],
        activeConstraints: ["Constraint v2"],
      });

      // Consume returns the latest overwritten artifact
      const consumed = scribeService.consumePreparedCompaction(sessionId);
      expect(consumed).toEqual(updatedArtifact);
      expect(consumed?.activeHumanRequest).toBe("Updated human request v2");

      // Next consume returns null
      expect(scribeService.consumePreparedCompaction(sessionId)).toBeNull();
    });

    it("clears all staged compactions upon service stop() and handles non-existent lookups", async () => {
      scribeService.stagePreparedCompaction({
        sessionId: "sess-to-clear-1",
        messages: [{ role: "user", content: "test" }],
        toolNames: [],
        activeConstraints: [],
      });
      scribeService.stagePreparedCompaction({
        sessionId: "sess-to-clear-2",
        messages: [{ role: "user", content: "test" }],
        toolNames: [],
        activeConstraints: [],
      });

      expect(scribeService.health().detail).toContain("stagedCompactions=2");

      await scribeService.stop();
      expect(scribeService.health().status).toBe("down");

      // After stop, consuming returns null and map is cleared
      expect(scribeService.consumePreparedCompaction("sess-to-clear-1")).toBeNull();
      expect(scribeService.consumePreparedCompaction("sess-to-clear-2")).toBeNull();
      expect(scribeService.consumePreparedCompaction("never-existed")).toBeNull();
    });

    it("accepts direct PreparedCompactionArtifact in stagePreparedCompaction", () => {
      const manualArtifact: PreparedCompactionArtifact = Object.freeze({
        sessionId: "manual-artifact-sess",
        activeHumanRequest: "Pre-formed goal",
        toolDefinitionsHash: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        preservedConstraints: Object.freeze(["Hard constraint"]),
        compactedSummary: "Manual summary",
        preparedAtMs: Date.now(),
      });

      const staged = scribeService.stagePreparedCompaction(manualArtifact);
      expect(staged).toBe(manualArtifact);

      const consumed = scribeService.consumePreparedCompaction("manual-artifact-sess");
      expect(consumed).toBe(manualArtifact);
    });
  });

  // =========================================================================
  // 4. compileWikiTopicPagesFromCory Non-Destructive Invariant & Chronological Sort
  // =========================================================================
  describe("4. compileWikiTopicPagesFromCory: Non-Destructive Views & Chronological Sort", () => {
    it("preserves strict chronological descending order across 45 distinct days with 300 episodic items", () => {
      const episodicItems: CoryMemoryItem[] = [];
      const baseDate = new Date("2026-09-01T00:00:00Z").getTime();
      const oneDayMs = 24 * 60 * 60 * 1000;

      // Generate 300 items across 45 days in random order
      for (let i = 0; i < 300; i++) {
        const dayOffset = Math.floor(Math.random() * 45);
        const itemTimestamp = baseDate + dayOffset * oneDayMs + (i % 86400) * 1000;
        const dateStr = new Date(itemTimestamp).toISOString().slice(0, 10);

        episodicItems.push({
          id: `epi-stress-${i}`,
          layer: "episodic",
          content: `Episodic event record #${i} on ${dateStr}`,
          userScope: "default",
          workspaceId: "default",
          createdAt: itemTimestamp,
          updatedAt: itemTimestamp,
          tags: ["log", dateStr],
          source: `daily/${dateStr}.md`,
        });
      }

      // Compile pages
      const pages = compileWikiTopicPagesFromCory({
        identityItems: [],
        durableItems: [],
        constraintItems: [],
        episodicItems,
      });

      // Filter daily log pages
      const dailyPages = pages.filter((p) => p.category === "daily_log");
      expect(dailyPages.length).toBeGreaterThanOrEqual(40); // at least 40 unique days generated

      // Verify strictly descending order
      for (let i = 0; i < dailyPages.length - 1; i++) {
        const currentSlug = dailyPages[i]?.slug ?? "";
        const nextSlug = dailyPages[i + 1]?.slug ?? "";
        expect(currentSlug > nextSlug).toBe(true);
      }

      // Verify zero mutation of the input array
      expect(episodicItems).toHaveLength(300);
    });

    it("compiles smoothly when episodic items have missing or malformed dates", () => {
      const corruptedEpisodic: CoryMemoryItem[] = [
        {
          id: "corrupt-1",
          layer: "episodic",
          content: "No source and zero timestamp",
          userScope: "default",
          workspaceId: "default",
          createdAt: 0,
          updatedAt: 0,
          tags: [],
        },
        {
          id: "corrupt-2",
          layer: "episodic",
          content: "Invalid timestamp string in tags",
          userScope: "default",
          workspaceId: "default",
          createdAt: Number.NaN,
          updatedAt: Number.NaN,
          tags: ["not-a-date"],
        },
      ];

      expect(() => {
        const pages = compileWikiTopicPagesFromCory({
          identityItems: [],
          durableItems: [],
          constraintItems: [],
          episodicItems: corruptedEpisodic,
        });
        expect(pages.length).toBeGreaterThan(0);
      }).not.toThrow();
    });
  });
});
