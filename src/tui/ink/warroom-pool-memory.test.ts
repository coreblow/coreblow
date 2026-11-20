import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseSquadMention } from "./warroom-cli.js";
import {
  CredentialPoolManager,
  maskApiKey,
} from "../../providers/credential-pool.js";
import {
  MemoryProposalStore,
  DialecticUserModel,
} from "../../memory/dialectic-user-model.js";

describe("warroom-pool-memory", () => {
  describe("War Room Squad Mention Parsing", () => {
    it("parses specialist mentions at start of prompt", () => {
      const coderRes = parseSquadMention("@coder write quicksort in TypeScript");
      expect(coderRes.isSquad).toBe(true);
      expect(coderRes.role).toBe("coder");
      expect(coderRes.cleanPrompt).toBe("write quicksort in TypeScript");

      const auditorRes = parseSquadMention("@auditor: check this auth middleware");
      expect(auditorRes.isSquad).toBe(true);
      expect(auditorRes.role).toBe("auditor");
      expect(auditorRes.cleanPrompt).toBe("check this auth middleware");

      const allRes = parseSquadMention("@all review the current plan");
      expect(allRes.isSquad).toBe(true);
      expect(allRes.role).toBe("all");
      expect(allRes.cleanPrompt).toBe("review the current plan");
    });

    it("parses squad mentions embedded within prompt", () => {
      const res = parseSquadMention("Please ask @researcher to look into this API");
      expect(res.isSquad).toBe(true);
      expect(res.role).toBe("researcher");
      expect(res.cleanPrompt).toBe("Please ask to look into this API");
    });

    it("rejects non-squad prompts", () => {
      const res = parseSquadMention("hello world, what time is it?");
      expect(res.isSquad).toBe(false);
      expect(res.cleanPrompt).toBe("hello world, what time is it?");
    });
  });

  describe("Credential Pool Management", () => {
    let tempDir: string;
    let pool: CredentialPoolManager;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-pool-test-"));
      pool = new CredentialPoolManager(tempDir);
    });

    afterEach(() => {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    });

    it("masks API keys properly", () => {
      expect(maskApiKey("sk-ant-1234567890abcdef")).toBe("sk-ant-...cdef");
      expect(maskApiKey("sk-proj-0987654321fedcba")).toBe("sk-proj...dcba");
    });

    it("resets provider cooldowns", () => {
      const cred = pool.addCredential({
        providerId: "anthropic",
        label: "Primary Anthropic",
        apiKey: "sk-ant-test-key-12345",
        priority: 1,
      });

      // Report 429 error to put in cooldown
      pool.reportCredentialOutcome(cred.id, {
        ok: false,
        statusCode: 429,
        retryAfterMs: 60000,
      });

      let masked = pool.getMaskedPools().pools.anthropic;
      expect(masked?.[0]?.cooldownUntilMs).toBeGreaterThan(Date.now());

      // Reset cooldown
      pool.resetCooldown();
      masked = pool.getMaskedPools().pools.anthropic;
      expect(masked?.[0]?.cooldownUntilMs).toBeUndefined();
    });

    it("toggles credential enabled state", () => {
      const cred = pool.addCredential({
        providerId: "openai",
        label: "OpenAI Key",
        apiKey: "sk-proj-test-key-9999",
        priority: 1,
      });

      expect(cred.enabled).toBe(true);
      pool.setCredentialEnabled(cred.id, false);
      const masked = pool.getMaskedPools().pools.openai;
      expect(masked?.[0]?.enabled).toBe(false);
    });
  });

  describe("Cory Memory Review (Proposals & Traits)", () => {
    let tempDir: string;
    let proposalStore: MemoryProposalStore;
    let dialecticModel: DialecticUserModel;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-mem-test-"));
      proposalStore = new MemoryProposalStore(tempDir);
      dialecticModel = new DialecticUserModel(tempDir);
    });

    afterEach(() => {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    });

    it("enqueues and approves TrustZone memory proposals", () => {
      const proposal = proposalStore.enqueueProposal({
        content: "User prefers concise caveman replies",
        targetLayer: "identity",
        source: "cli",
      });

      expect(proposal.status).toBe("pending");
      expect(proposalStore.listPendingProposals().length).toBe(1);

      const resolved = proposalStore.resolveProposal(proposal.id, "approve");
      expect(resolved?.status).toBe("approved");
      expect(proposalStore.listPendingProposals().length).toBe(0);
    });

    it("enqueues and dismisses memory proposals", () => {
      const proposal = proposalStore.enqueueProposal({
        content: "Ephemeral fact to discard",
        targetLayer: "episodic",
        source: "cli",
      });

      const dismissed = proposalStore.resolveProposal(proposal.id, "dismiss");
      expect(dismissed?.status).toBe("dismissed");
      expect(proposalStore.listPendingProposals().length).toBe(0);
    });

    it("ingests and removes active dialectic traits", () => {
      dialecticModel.ingestSignal({
        id: "sig_tech_stack",
        dimension: "tech_stack",
        key: "framework",
        value: "React + Ink",
        confidence: 0.95,
        updatedAt: Date.now(),
      });

      expect(dialecticModel.getActiveTraits().length).toBe(1);
      expect(dialecticModel.getActiveTraits()[0]?.key).toBe("framework");

      const removed = dialecticModel.removeSignal("sig_tech_stack");
      expect(removed).toBe(true);
      expect(dialecticModel.getActiveTraits().length).toBe(0);
    });
  });
});
