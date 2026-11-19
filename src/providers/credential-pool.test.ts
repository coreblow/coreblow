import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CredentialPoolManager,
  maskApiKey,
} from "./credential-pool.js";

describe("CredentialPoolManager (src/providers/credential-pool.ts)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-cred-pool-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe("1. Key Masking & Persistence Security", () => {
    it("masks API keys properly and never exposes raw secrets in masked output", () => {
      expect(maskApiKey("sk-ant-api03-abcdef1234567890")).toBe("sk-ant-...7890");
      expect(maskApiKey("sk-proj-xyz9876543210")).toBe("sk-proj...3210");
      expect(maskApiKey("gsk_ultra123456789")).toBe("gsk_...6789");
      expect(maskApiKey("short")).toBe("••••••••");

      const manager = new CredentialPoolManager(tempDir);
      manager.addCredential({
        providerId: "anthropic",
        apiKey: "sk-ant-real-secret-key-1234",
        label: "Production Key 1",
      });

      const masked = manager.getMaskedPools();
      expect(masked.pools.anthropic).toBeDefined();
      expect(masked.pools.anthropic.length).toBe(1);
      expect(masked.pools.anthropic[0].apiKey).toBe("sk-ant-...1234");
      expect(masked.pools.anthropic[0].apiKey).not.toContain("real-secret");
    });
  });

  describe("2. Multi-Key Selection, 429 Cooldown Rotation & Failover", () => {
    it("selects key #1, rotates to key #2 on HTTP 429 rate limit, and triggers fallback chain when pool is exhausted", () => {
      const manager = new CredentialPoolManager(tempDir);

      // Configure Anthropic pool with 2 keys
      const key1 = manager.addCredential({
        providerId: "anthropic",
        apiKey: "sk-ant-key-1-alpha",
        label: "Key 1",
        priority: 1,
      });
      const key2 = manager.addCredential({
        providerId: "anthropic",
        apiKey: "sk-ant-key-2-beta",
        label: "Key 2",
        priority: 2,
      });

      // Configure OpenAI fallback key
      const keyOpenAi = manager.addCredential({
        providerId: "openai",
        apiKey: "sk-proj-openai-backup",
        label: "OpenAI Backup",
        priority: 1,
      });

      // 1. Initial selection should pick highest priority key #1
      const sel1 = manager.selectCredential("anthropic");
      expect(sel1).not.toBeNull();
      expect(sel1?.credential.id).toBe(key1.id);
      expect(sel1?.fallbackSwitched).toBe(false);

      // 2. Key #1 receives HTTP 429 -> placed in cooldown
      const report1 = manager.reportCredentialOutcome(key1.id, {
        ok: false,
        statusCode: 429,
        retryAfterMs: 60_000,
      });
      expect(report1.placedInCooldown).toBe(true);

      // 3. Next selection should rotate immediately to key #2
      const sel2 = manager.selectCredential("anthropic");
      expect(sel2).not.toBeNull();
      expect(sel2?.credential.id).toBe(key2.id);
      expect(sel2?.fallbackSwitched).toBe(false);

      // 4. Key #2 also receives 429 -> placed in cooldown
      const report2 = manager.reportCredentialOutcome(key2.id, {
        ok: false,
        statusCode: 429,
        retryAfterMs: 60_000,
      });
      expect(report2.placedInCooldown).toBe(true);

      // 5. Entire Anthropic pool exhausted -> Daybreak Fallback Chain triggers to OpenAI!
      const sel3 = manager.selectCredential("anthropic");
      expect(sel3).not.toBeNull();
      expect(sel3?.fallbackSwitched).toBe(true);
      expect(sel3?.providerId).toBe("openai");
      expect(sel3?.credential.id).toBe(keyOpenAi.id);
      expect(sel3?.reason).toContain("Primary provider 'anthropic' pool exhausted");
    });
  });

  describe("3. Token & Cost Telemetry Accumulation", () => {
    it("accumulates token counts and calculates estimated USD cost deterministically", () => {
      const manager = new CredentialPoolManager(tempDir);
      const cred = manager.addCredential({
        providerId: "anthropic",
        apiKey: "sk-ant-telemetry-test",
        label: "Telemetry Key",
      });

      // Report 200 OK with 10,000 input tokens and 2,000 output tokens
      // Anthropic pricing: $3.00/1M input, $15.00/1M output
      // Cost = (10,000/1M * 3) + (2,000/1M * 15) = 0.03 + 0.03 = 0.06 USD
      const outcome = manager.reportCredentialOutcome(cred.id, {
        ok: true,
        inputTokens: 10_000,
        outputTokens: 2_000,
      });

      expect(outcome.placedInCooldown).toBe(false);
      expect(outcome.estimatedCostUsd).toBeCloseTo(0.06, 4);

      const masked = manager.getMaskedPools();
      const storedKey = masked.pools.anthropic[0];
      expect(storedKey.inputTokens).toBe(10_000);
      expect(storedKey.outputTokens).toBe(2_000);
      expect(storedKey.totalTokens).toBe(12_000);
      expect(storedKey.estimatedCostUsd).toBeCloseTo(0.06, 4);

      // Verify rolling telemetry
      expect(masked.telemetry.lifetime.requests).toBe(1);
      expect(masked.telemetry.lifetime.totalTokens).toBe(12_000);
      expect(masked.telemetry.lifetime.estimatedCostUsd).toBeCloseTo(0.06, 4);
    });
  });
});
