import { describe, it, expect } from "vitest";
import { PriorityRouter } from "./priority.js";
import type { PriorityRule, PriorityTier } from "./priority.js";

function makeMessage(overrides: Partial<{ senderId: string; channel: string; text: string }> = {}) {
  return {
    senderId: overrides.senderId ?? "user1",
    channel: overrides.channel ?? "discord",
    text: overrides.text ?? "hello",
    agentId: "default",
    sessionKey: "main",
    timestamp: Date.now(),
  } as any;
}

describe("PriorityRouter", () => {
  describe("rule management", () => {
    it("adds and lists rules sorted by tier weight (highest first)", () => {
      const router = new PriorityRouter();
      router.addRule({ id: "r1", match: { channel: "discord" }, priority: "low" });
      router.addRule({ id: "r2", match: { channel: "slack" }, priority: "critical" });

      const rules = router.listRules();
      expect(rules[0].priority).toBe("critical");
      expect(rules[1].priority).toBe("low");
    });

    it("removes rules by id", () => {
      const router = new PriorityRouter();
      router.addRule({ id: "r1", match: { channel: "discord" }, priority: "high" });
      expect(router.removeRule("r1")).toBe(true);
      expect(router.removeRule("nonexistent")).toBe(false);
      expect(router.listRules()).toHaveLength(0);
    });
  });

  describe("VIP management", () => {
    it("adds and checks VIP users", () => {
      const router = new PriorityRouter();
      router.addVip("vip-user");
      expect(router.isVip("vip-user")).toBe(true);
      expect(router.isVip("regular-user")).toBe(false);
    });

    it("removes VIP users", () => {
      const router = new PriorityRouter();
      router.addVip("vip-user");
      expect(router.removeVip("vip-user")).toBe(true);
      expect(router.removeVip("vip-user")).toBe(false);
      expect(router.isVip("vip-user")).toBe(false);
    });
  });

  describe("resolve", () => {
    it("returns high priority for VIP users", () => {
      const router = new PriorityRouter();
      router.addVip("vip-user");

      const result = router.resolve(makeMessage({ senderId: "vip-user" }));
      expect(result.tier).toBe("high");
      expect(result.weight).toBe(75);
    });

    it("matches rules by userId", () => {
      const router = new PriorityRouter();
      router.addRule({ id: "r1", match: { userId: "special" }, priority: "critical", model: "gpt-5" });

      const result = router.resolve(makeMessage({ senderId: "special" }));
      expect(result.tier).toBe("critical");
      expect(result.model).toBe("gpt-5");
    });

    it("matches rules by userIds array", () => {
      const router = new PriorityRouter();
      router.addRule({ id: "r1", match: { userIds: ["a", "b"] }, priority: "high" });

      expect(router.resolve(makeMessage({ senderId: "a" })).tier).toBe("high");
      expect(router.resolve(makeMessage({ senderId: "c" })).tier).toBe("normal");
    });

    it("matches rules by channel", () => {
      const router = new PriorityRouter();
      router.addRule({ id: "r1", match: { channel: "slack" }, priority: "low" });

      expect(router.resolve(makeMessage({ channel: "slack" })).tier).toBe("low");
      expect(router.resolve(makeMessage({ channel: "discord" })).tier).toBe("normal");
    });

    it("matches rules by text pattern", () => {
      const router = new PriorityRouter();
      router.addRule({ id: "r1", match: { pattern: /urgent/i }, priority: "critical" });

      expect(router.resolve(makeMessage({ text: "URGENT: fix now" })).tier).toBe("critical");
      expect(router.resolve(makeMessage({ text: "normal message" })).tier).toBe("normal");
    });

    it("returns normal priority when no rules match", () => {
      const router = new PriorityRouter();
      const result = router.resolve(makeMessage());
      expect(result.tier).toBe("normal");
      expect(result.weight).toBe(50);
    });

    it("VIP takes precedence over rules", () => {
      const router = new PriorityRouter();
      router.addVip("vip-user");
      router.addRule({ id: "r1", match: { userId: "vip-user" }, priority: "low" });

      const result = router.resolve(makeMessage({ senderId: "vip-user" }));
      expect(result.tier).toBe("high"); // VIP overrides the low rule
    });
  });

  describe("load balancing", () => {
    it("returns least loaded channel", () => {
      const router = new PriorityRouter();
      router.updateLoad("discord", 10, 200, 0.1);
      router.updateLoad("slack", 2, 100, 0.01);
      router.updateLoad("telegram", 5, 150, 0.05);

      expect(router.getLeastLoaded()).toBe("slack");
    });

    it("returns undefined when no load info", () => {
      const router = new PriorityRouter();
      expect(router.getLeastLoaded()).toBeUndefined();
    });

    it("returns all load info", () => {
      const router = new PriorityRouter();
      router.updateLoad("discord", 5, 100, 0.02);
      const info = router.getLoadInfo();
      expect(info).toHaveLength(1);
      expect(info[0].channel).toBe("discord");
    });
  });

  describe("stats", () => {
    it("records tier usage and reports stats", () => {
      const router = new PriorityRouter();
      router.addRule({ id: "r1", match: { channel: "discord" }, priority: "high" });
      router.addVip("v1");
      router.recordTierUsage("high");
      router.recordTierUsage("high");
      router.recordTierUsage("normal");

      const stats = router.getStats();
      expect(stats.rules).toBe(1);
      expect(stats.vipUsers).toBe(1);
      expect(stats.tierUsage.high).toBe(2);
      expect(stats.tierUsage.normal).toBe(1);
    });
  });
});
