import { describe, expect, it } from "vitest";
import {
  normalizePluginInteractiveNamespace,
  resolvePluginInteractiveMatch,
  toPluginInteractiveRegistryKey,
  validatePluginInteractiveNamespace,
} from "./interactive-shared.js";

describe("toPluginInteractiveRegistryKey", () => {
  it("should create key from channel and namespace", () => {
    expect(toPluginInteractiveRegistryKey("discord", "mybot")).toBe("discord:mybot");
  });

  it("should normalize channel to lowercase", () => {
    expect(toPluginInteractiveRegistryKey("Discord", "mybot")).toBe("discord:mybot");
  });

  it("should trim namespace", () => {
    expect(toPluginInteractiveRegistryKey("discord", "  mybot  ")).toBe("discord:mybot");
  });

  it("should handle empty channel", () => {
    expect(toPluginInteractiveRegistryKey("", "mybot")).toBe(":mybot");
  });
});

describe("normalizePluginInteractiveNamespace", () => {
  it("should trim whitespace", () => {
    expect(normalizePluginInteractiveNamespace("  mybot  ")).toBe("mybot");
  });

  it("should preserve internal whitespace", () => {
    expect(normalizePluginInteractiveNamespace("my bot")).toBe("my bot");
  });
});

describe("validatePluginInteractiveNamespace", () => {
  it("should return null for valid namespace", () => {
    expect(validatePluginInteractiveNamespace("mybot")).toBeNull();
  });

  it("should allow letters, numbers, dots, underscores, hyphens", () => {
    expect(validatePluginInteractiveNamespace("my-bot_123.v2")).toBeNull();
  });

  it("should reject empty namespace", () => {
    expect(validatePluginInteractiveNamespace("")).toBe(
      "Interactive handler namespace cannot be empty",
    );
  });

  it("should reject whitespace-only namespace", () => {
    expect(validatePluginInteractiveNamespace("   ")).toBe(
      "Interactive handler namespace cannot be empty",
    );
  });

  it("should reject namespace with spaces", () => {
    expect(validatePluginInteractiveNamespace("my bot")).toContain(
      "must contain only letters, numbers, dots, underscores, and hyphens",
    );
  });

  it("should reject namespace with special characters", () => {
    expect(validatePluginInteractiveNamespace("my@bot")).toContain(
      "must contain only letters, numbers, dots, underscores, and hyphens",
    );
  });
});

describe("resolvePluginInteractiveMatch", () => {
  it("should return null for empty data", () => {
    const handlers = new Map();
    expect(
      resolvePluginInteractiveMatch({
        interactiveHandlers: handlers,
        channel: "discord",
        data: "",
      }),
    ).toBeNull();
  });

  it("should return null for whitespace-only data", () => {
    const handlers = new Map();
    expect(
      resolvePluginInteractiveMatch({
        interactiveHandlers: handlers,
        channel: "discord",
        data: "   ",
      }),
    ).toBeNull();
  });

  it("should match namespace without payload", () => {
    const registration = { id: "test" };
    const handlers = new Map([["discord:mybot", registration]]);

    const result = resolvePluginInteractiveMatch({
      interactiveHandlers: handlers,
      channel: "discord",
      data: "mybot",
    });

    expect(result).toEqual({
      registration,
      namespace: "mybot",
      payload: "",
    });
  });

  it("should match namespace with payload", () => {
    const registration = { id: "test" };
    const handlers = new Map([["discord:mybot", registration]]);

    const result = resolvePluginInteractiveMatch({
      interactiveHandlers: handlers,
      channel: "discord",
      data: "mybot:action123",
    });

    expect(result).toEqual({
      registration,
      namespace: "mybot",
      payload: "action123",
    });
  });

  it("should handle payload with multiple colons", () => {
    const registration = { id: "test" };
    const handlers = new Map([["discord:mybot", registration]]);

    const result = resolvePluginInteractiveMatch({
      interactiveHandlers: handlers,
      channel: "discord",
      data: "mybot:action:sub:data",
    });

    expect(result).toEqual({
      registration,
      namespace: "mybot",
      payload: "action:sub:data",
    });
  });

  it("should return null when namespace not found", () => {
    const handlers = new Map([["discord:mybot", { id: "test" }]]);

    expect(
      resolvePluginInteractiveMatch({
        interactiveHandlers: handlers,
        channel: "discord",
        data: "otherbot:action",
      }),
    ).toBeNull();
  });

  it("should normalize channel when matching", () => {
    const registration = { id: "test" };
    const handlers = new Map([["discord:mybot", registration]]);

    const result = resolvePluginInteractiveMatch({
      interactiveHandlers: handlers,
      channel: "Discord",
      data: "mybot:action",
    });

    expect(result).toEqual({
      registration,
      namespace: "mybot",
      payload: "action",
    });
  });
});
