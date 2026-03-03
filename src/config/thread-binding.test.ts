import { describe, it, expect, beforeEach } from "vitest";
import {
  bindThread,
  getBinding,
  unbindThread,
  listBindings,
  clearBindings,
  resolveThreadModel,
  resolveThreadPrompt,
  cleanupExpired,
  getBindingStats,
} from "./thread-binding.js";

describe("thread-binding", () => {
  beforeEach(() => {
    clearBindings();
  });

  describe("bindThread", () => {
    it("creates a new binding", () => {
      const binding = bindThread("thread-1", "discord");
      expect(binding.threadId).toBe("thread-1");
      expect(binding.channelId).toBe("discord");
      expect(binding.createdAt).toBeGreaterThan(0);
      expect(binding.updatedAt).toBeGreaterThan(0);
    });

    it("applies overrides", () => {
      const binding = bindThread("thread-1", "discord", {
        agentId: "agent-1",
        model: "gpt-5",
        systemPrompt: "You are helpful",
        temperature: 0.7,
      });
      expect(binding.agentId).toBe("agent-1");
      expect(binding.model).toBe("gpt-5");
      expect(binding.systemPrompt).toBe("You are helpful");
      expect(binding.temperature).toBe(0.7);
    });

    it("sets TTL when ttlMs is provided", () => {
      const binding = bindThread("thread-1", "discord", {}, { ttlMs: 60000 });
      expect(binding.expiresAt).toBeDefined();
      expect(binding.expiresAt!).toBeGreaterThan(Date.now());
    });

    it("inherits from existing binding when inherit=true", () => {
      bindThread("thread-1", "discord", { model: "gpt-4", temperature: 0.5 });
      const updated = bindThread(
        "thread-1",
        "discord",
        { systemPrompt: "new prompt" },
        { inherit: true },
      );
      expect(updated.model).toBe("gpt-4");
      expect(updated.temperature).toBe(0.5);
      expect(updated.systemPrompt).toBe("new prompt");
    });

    it("preserves original createdAt on update", () => {
      const first = bindThread("thread-1", "discord");
      const second = bindThread("thread-1", "discord", { model: "gpt-5" });
      expect(second.createdAt).toBe(first.createdAt);
      expect(second.updatedAt).toBeGreaterThanOrEqual(first.updatedAt);
    });
  });

  describe("getBinding", () => {
    it("returns binding by threadId", () => {
      bindThread("thread-1", "discord");
      expect(getBinding("thread-1")).toBeDefined();
    });

    it("returns undefined for missing threadId", () => {
      expect(getBinding("nonexistent")).toBeUndefined();
    });

    it("returns undefined for expired binding", () => {
      bindThread("thread-1", "discord", {}, { ttlMs: -1 }); // already expired
      expect(getBinding("thread-1")).toBeUndefined();
    });
  });

  describe("unbindThread", () => {
    it("removes binding and returns true", () => {
      bindThread("thread-1", "discord");
      expect(unbindThread("thread-1")).toBe(true);
      expect(getBinding("thread-1")).toBeUndefined();
    });

    it("returns false for non-existent binding", () => {
      expect(unbindThread("nonexistent")).toBe(false);
    });
  });

  describe("listBindings", () => {
    it("lists all bindings", () => {
      bindThread("t1", "discord");
      bindThread("t2", "slack");
      expect(listBindings()).toHaveLength(2);
    });

    it("filters by channelId", () => {
      bindThread("t1", "discord");
      bindThread("t2", "slack");
      bindThread("t3", "discord");
      expect(listBindings("discord")).toHaveLength(2);
      expect(listBindings("slack")).toHaveLength(1);
    });

    it("excludes expired bindings", () => {
      bindThread("t1", "discord");
      bindThread("t2", "discord", {}, { ttlMs: -1 });
      expect(listBindings("discord")).toHaveLength(1);
    });
  });

  describe("clearBindings", () => {
    it("clears all bindings", () => {
      bindThread("t1", "discord");
      bindThread("t2", "slack");
      const cleared = clearBindings();
      expect(cleared).toBe(2);
      expect(listBindings()).toHaveLength(0);
    });

    it("clears bindings for specific channel", () => {
      bindThread("t1", "discord");
      bindThread("t2", "slack");
      bindThread("t3", "discord");
      const cleared = clearBindings("discord");
      expect(cleared).toBe(2);
      expect(listBindings()).toHaveLength(1);
    });
  });

  describe("resolveThreadModel", () => {
    it("returns thread model when bound", () => {
      bindThread("t1", "ch", { model: "gpt-5" });
      expect(resolveThreadModel("t1", "default-model")).toBe("gpt-5");
    });

    it("returns fallback when no binding", () => {
      expect(resolveThreadModel("missing", "default-model")).toBe("default-model");
    });
  });

  describe("resolveThreadPrompt", () => {
    it("returns thread prompt when bound", () => {
      bindThread("t1", "ch", { systemPrompt: "Custom prompt" });
      expect(resolveThreadPrompt("t1", "default prompt")).toBe("Custom prompt");
    });

    it("returns fallback when no binding", () => {
      expect(resolveThreadPrompt("missing", "default prompt")).toBe("default prompt");
    });
  });

  describe("cleanupExpired", () => {
    it("removes expired bindings", () => {
      bindThread("t1", "ch", {}, { ttlMs: -1 });
      bindThread("t2", "ch");
      const cleaned = cleanupExpired();
      expect(cleaned).toBe(1);
      expect(listBindings()).toHaveLength(1);
    });
  });

  describe("getBindingStats", () => {
    it("returns stats grouped by channel", () => {
      bindThread("t1", "discord");
      bindThread("t2", "discord");
      bindThread("t3", "slack");
      const stats = getBindingStats();
      expect(stats.total).toBe(3);
      expect(stats.byChannel.discord).toBe(2);
      expect(stats.byChannel.slack).toBe(1);
    });
  });
});
