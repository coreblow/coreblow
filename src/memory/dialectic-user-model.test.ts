import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  extractDialecticSignals,
  DialecticUserModel,
  MemoryProposalStore,
  unifiedHybridRecall,
} from "./dialectic-user-model.js";
import {
  CoryBootstrapService,
  CoryMemoryStore,
  CorySearchIndex,
} from "./cory.js";
import { saveUnifiedSessionStoreSync } from "../sessions/unified-session-store.js";

describe("Cory Dialectic Engine v2 (src/memory/dialectic-user-model.ts)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-dialectic-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe("1. Automatic Signal Extraction (Indonesian, English, Tech Stack, Constraints)", () => {
    it("extracts Indonesian language and concise tone preferences", () => {
      const text = "Tolong buatkan fungsi dalam TypeScript secara singkat dan padat tanpa basa-basi.";
      const signals = extractDialecticSignals({ text, sessionId: "sess-id-1" });

      expect(signals.length).toBeGreaterThanOrEqual(2);

      const langSignal = signals.find((s) => s.key === "preferred_language");
      expect(langSignal).toBeDefined();
      expect(langSignal?.value).toBe("Indonesian");
      expect(langSignal?.dimension).toBe("communication_style");

      const toneSignal = signals.find((s) => s.key === "tone_preference");
      expect(toneSignal).toBeDefined();
      expect(toneSignal?.value).toBe("Concise & Terse");

      const stackSignal = signals.find((s) => s.key === "primary_language");
      expect(stackSignal).toBeDefined();
      expect(stackSignal?.value).toBe("TypeScript");
    });

    it("extracts English language, detailed tone, and hard constraints", () => {
      const text =
        "Please provide a comprehensive explanation. Never bypass gateway security policy under any circumstances.";
      const signals = extractDialecticSignals({ text, sessionId: "sess-en-1" });

      const langSignal = signals.find((s) => s.key === "preferred_language");
      expect(langSignal).toBeDefined();
      expect(langSignal?.value).toBe("English");

      const toneSignal = signals.find((s) => s.key === "tone_preference");
      expect(toneSignal).toBeDefined();
      expect(toneSignal?.value).toBe("Detailed & Comprehensive");

      const constraintSignal = signals.find((s) => s.dimension === "hard_constraints");
      expect(constraintSignal).toBeDefined();
      expect(constraintSignal?.value.toLowerCase()).toContain("never bypass gateway security policy");
    });

    it("extracts framework switches and active projects", () => {
      const text =
        "We are migrating the desktop app to Electron. Working on repo coreblow in /Users/febrinanda/coreblow.";
      const signals = extractDialecticSignals({ text, sessionId: "sess-fw-1" });

      const fwSignal = signals.find((s) => s.key === "desktop_framework");
      expect(fwSignal).toBeDefined();
      expect(fwSignal?.value).toBe("Electron");

      const projSignal = signals.find((s) => s.key === "project_name");
      expect(projSignal).toBeDefined();
      expect(projSignal?.value).toBe("coreblow");

      const pathSignal = signals.find((s) => s.key === "workspace_path");
      expect(pathSignal).toBeDefined();
      expect(pathSignal?.value).toBe("/Users/febrinanda/coreblow");
    });
  });

  describe("2. Contradiction & Supersede Resolution", () => {
    it("automatically supersedes older preference when contradicted by a newer turn", () => {
      const model = new DialecticUserModel(tempDir);

      // Turn 1: User indicates Flutter framework
      const turn1Signals = model.ingestTurn("Building our mobile and desktop client using Flutter.");
      const activeFw1 = model.getActiveTraits().find((t) => t.key === "desktop_framework");
      expect(activeFw1).toBeDefined();
      expect(activeFw1?.value).toBe("Flutter");
      const turn1Id = activeFw1!.id;

      // Turn 2: User switches to Electron
      const turn2Signals = model.ingestTurn("We decided to switch desktop framework to Electron.");
      const activeTraits = model.getActiveTraits();
      const activeFw2 = activeTraits.find((t) => t.key === "desktop_framework");

      expect(activeFw2).toBeDefined();
      expect(activeFw2?.value).toBe("Electron");
      expect(activeFw2?.id).not.toBe(turn1Id);

      // Verify the old Flutter record is retained in history but marked supersededBy
      const allSignals = model.getAllSignals();
      const oldSignal = allSignals.find((s) => s.id === turn1Id);
      expect(oldSignal).toBeDefined();
      expect(oldSignal?.supersededBy).toBe(activeFw2!.id);

      // Verify persistence survives reloading from disk
      const reloadedModel = new DialecticUserModel(tempDir);
      const reloadedActive = reloadedModel.getActiveTraits();
      expect(reloadedActive.find((t) => t.key === "desktop_framework")?.value).toBe("Electron");
      expect(reloadedModel.getAllSignals().find((s) => s.id === turn1Id)?.supersededBy).toBe(activeFw2!.id);
    });
  });

  describe("3. TrustZone Isolation & Proposal Staging Queue", () => {
    it("enqueues proposals in staging queue for public channels and promotes cleanly on approval", () => {
      const proposalStore = new MemoryProposalStore(tempDir);
      const index = new CorySearchIndex(tempDir);
      const memoryStore = new CoryMemoryStore(tempDir, index);

      // Verify initially empty
      expect(proposalStore.listPendingProposals().length).toBe(0);

      // 1. Enqueue proposal from a public/group channel
      const proposal = proposalStore.enqueueProposal({
        content: "Operator timezone is Asia/Jakarta (UTC+7)",
        targetLayer: "identity",
        dimension: "communication_style",
        source: "public_channel:telegram_group_999",
      });

      expect(proposal.id).toBeDefined();
      expect(proposal.status).toBe("pending");

      const pendingList = proposalStore.listPendingProposals();
      expect(pendingList.length).toBe(1);
      expect(pendingList[0].id).toBe(proposal.id);

      // Ensure private USER.md was NOT modified directly
      const identityItemsBefore = memoryStore.listLayerItems("identity");
      expect(identityItemsBefore.some((i) => i.content.includes("Asia/Jakarta"))).toBe(false);

      // 2. Approve proposal -> writes into Cory canonical layer
      const resolved = proposalStore.resolveProposal(proposal.id, "approve", memoryStore);
      expect(resolved).not.toBeNull();
      expect(resolved?.status).toBe("approved");

      // Verify pending queue is now cleared
      expect(proposalStore.listPendingProposals().length).toBe(0);

      // Verify canonical identity layer now contains the approved memory
      const identityItemsAfter = memoryStore.listLayerItems("identity");
      expect(identityItemsAfter.some((i) => i.content.includes("Asia/Jakarta"))).toBe(true);

      index.close();
    });

    it("dismisses unwanted proposals without touching canonical memory", () => {
      const proposalStore = new MemoryProposalStore(tempDir);
      const index = new CorySearchIndex(tempDir);
      const memoryStore = new CoryMemoryStore(tempDir, index);

      const prop = proposalStore.enqueueProposal({
        content: "Spam fact from untrusted user",
        targetLayer: "durable",
        source: "public_channel:discord_general",
      });

      const dismissed = proposalStore.resolveProposal(prop.id, "dismiss", memoryStore);
      expect(dismissed?.status).toBe("dismissed");
      expect(proposalStore.listPendingProposals().length).toBe(0);

      const durableItems = memoryStore.listLayerItems("durable");
      expect(durableItems.some((i) => i.content.includes("Spam fact"))).toBe(false);

      index.close();
    });
  });

  describe("4. Unified Hybrid Recall Engine", () => {
    it("searches across Cory Memory, Dialectic Profile, and Session Store with recency & layer weighting", () => {
      const index = new CorySearchIndex(tempDir);
      const memoryStore = new CoryMemoryStore(tempDir, index);
      const dialecticModel = new DialecticUserModel(tempDir);

      // 1. Seed Cory memory items
      memoryStore.remember({
        layer: "constraint",
        content: "Never allow unencrypted tokens in logs.",
      });
      memoryStore.remember({
        layer: "durable",
        content: "Single-Brain gateway runs on port 18789.",
      });

      // 2. Seed Dialectic Profile traits
      dialecticModel.ingestTurn("We develop desktop apps with Electron and TypeScript.");

      // 3. Seed Unified Session Store
      const sessionPath = path.join(tempDir, "sessions", "sessions-store.json");
      saveUnifiedSessionStoreSync(
        {
          version: 1,
          sessions: {
            sess_test_1: {
              id: "sess_test_1",
              title: "Architecture Planning",
              createdAt: Date.now() - 3600000,
              updatedAt: Date.now(),
              surface: "desktop",
              messages: [
                {
                  id: "msg_1",
                  role: "user",
                  content: "How should we design the gateway port 18789 SSE streaming?",
                  createdAt: Date.now() - 3600000,
                },
                {
                  id: "msg_2",
                  role: "assistant",
                  content: "Use Node.js ServerResponse with Content-Type: text/event-stream.",
                  createdAt: Date.now() - 3500000,
                },
              ],
            },
          },
        },
        sessionPath,
      );

      // 4. Run Unified Hybrid Recall for "gateway port 18789"
      const recall1 = unifiedHybridRecall({
        query: "gateway port 18789",
        memoryStore,
        dialecticModel,
        sessionStorePath: sessionPath,
        topK: 5,
      });

      expect(recall1.hits.length).toBeGreaterThanOrEqual(2);
      expect(recall1.hits.some((h) => h.source === "cory_memory")).toBe(true);
      expect(recall1.hits.some((h) => h.source === "session_store")).toBe(true);

      // 5. Run Unified Hybrid Recall for "TypeScript Electron"
      const recall2 = unifiedHybridRecall({
        query: "TypeScript Electron",
        memoryStore,
        dialecticModel,
        sessionStorePath: sessionPath,
        topK: 5,
      });

      expect(recall2.hits.length).toBeGreaterThanOrEqual(1);
      expect(recall2.hits.some((h) => h.source === "dialectic_profile")).toBe(true);

      // 6. Constraints must rank high for matching security keywords
      const recall3 = unifiedHybridRecall({
        query: "tokens logs",
        memoryStore,
        dialecticModel,
        topK: 5,
      });

      expect(recall3.hits.length).toBeGreaterThanOrEqual(1);
      expect(recall3.hits[0].layer).toBe("constraint");

      index.close();
    });
  });
});
