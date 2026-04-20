/**
 * agents/provider-id.test.ts
 * Ported to match OpenClaw normalizeProviderId behavior.
 */
import { describe, it, expect } from "vitest";
import {
  normalizeProviderId,
  normalizeProviderIdForAuth,
  findNormalizedProviderKey,
  findNormalizedProviderValue,
  parseModelRef,
  buildModelRef,
} from "./provider-id.js";

describe("Provider ID", () => {
  describe("normalizeProviderId", () => {
    it("lowercases and trims", () => {
      expect(normalizeProviderId("  OpenAI  ")).toBe("openai");
      expect(normalizeProviderId("ANTHROPIC")).toBe("anthropic");
    });
    it("preserves hyphens", () => {
      expect(normalizeProviderId("openai-codex")).toBe("openai-codex");
      expect(normalizeProviderId("amazon-bedrock")).toBe("amazon-bedrock");
      expect(normalizeProviderId("azure-openai-responses")).toBe("azure-openai-responses");
    });
    it("maps z.ai and z-ai to zai", () => {
      expect(normalizeProviderId("z.ai")).toBe("zai");
      expect(normalizeProviderId("z-ai")).toBe("zai");
    });
    it("maps kimi variants", () => {
      expect(normalizeProviderId("kimi")).toBe("kimi");
      expect(normalizeProviderId("kimi-code")).toBe("kimi");
      expect(normalizeProviderId("kimi-coding")).toBe("kimi");
    });
    it("maps bedrock aliases", () => {
      expect(normalizeProviderId("bedrock")).toBe("amazon-bedrock");
      expect(normalizeProviderId("aws-bedrock")).toBe("amazon-bedrock");
    });
    it("maps legacy naming", () => {
      expect(normalizeProviderId("bytedance")).toBe("volcengine");
      expect(normalizeProviderId("doubao")).toBe("volcengine");
    });
    it("passes through unknown providers unchanged", () => {
      expect(normalizeProviderId("custom-provider")).toBe("custom-provider");
      expect(normalizeProviderId("deepseek")).toBe("deepseek");
    });
  });

  describe("normalizeProviderIdForAuth", () => {
    it("maps volcengine-plan to volcengine", () =>
      expect(normalizeProviderIdForAuth("volcengine-plan")).toBe("volcengine"));
    it("maps byteplus-plan to byteplus", () =>
      expect(normalizeProviderIdForAuth("byteplus-plan")).toBe("byteplus"));
    it("keeps others", () => expect(normalizeProviderIdForAuth("openai")).toBe("openai"));
  });

  describe("findNormalizedProviderKey", () => {
    it("finds key by normalized match", () => {
      const map = { OpenAI: "key1", Anthropic: "key2" };
      expect(findNormalizedProviderKey(map, "openai")).toBe("OpenAI");
    });
    it("returns undefined for missing", () => {
      expect(findNormalizedProviderKey({ x: 1 }, "openai")).toBeUndefined();
    });
    it("returns undefined for undefined entries", () => {
      expect(findNormalizedProviderKey(undefined, "openai")).toBeUndefined();
    });
  });

  describe("findNormalizedProviderValue", () => {
    it("finds value by normalized match", () => {
      const map = { OpenAI: "val1", Anthropic: "val2" };
      expect(findNormalizedProviderValue(map, "openai")).toBe("val1");
    });
    it("returns undefined for missing", () => {
      expect(findNormalizedProviderValue({ x: 1 }, "openai")).toBeUndefined();
    });
  });

  describe("parseModelRef", () => {
    it("parses provider/model", () => {
      const ref = parseModelRef("openai/gpt-4o");
      expect(ref).toEqual({ provider: "openai", model: "gpt-4o" });
    });
    it("normalizes provider", () => {
      expect(parseModelRef("bedrock/claude-3")!.provider).toBe("amazon-bedrock");
    });
    it("preserves hyphenated providers", () => {
      expect(parseModelRef("openai-codex/gpt-5.4")!.provider).toBe("openai-codex");
    });
    it("returns null for no separator", () => {
      expect(parseModelRef("gpt-4o")).toBeNull();
    });
  });

  describe("buildModelRef", () => {
    it("builds ref", () => expect(buildModelRef("openai", "gpt-4o")).toBe("openai/gpt-4o"));
    it("preserves hyphens", () =>
      expect(buildModelRef("openai-codex", "gpt-5.4")).toBe("openai-codex/gpt-5.4"));
  });
});
