import { describe, expect, it } from "vitest";
import {
  buildConfiguredAcpSessionKey,
  normalizeBindingConfig,
  normalizeMode,
  normalizeText,
  parseConfiguredAcpSessionKey,
  toConfiguredAcpBindingRecord,
} from "./persistent-bindings.types.js";
import type { ConfiguredAcpBindingSpec } from "./persistent-bindings.types.js";

const baseSpec: ConfiguredAcpBindingSpec = {
  channel: "telegram",
  accountId: "default",
  conversationId: "-1001234567890",
  agentId: "main",
  mode: "persistent",
};

describe("normalizeText", () => {
  it("returns trimmed string for non-empty strings", () => {
    expect(normalizeText("  hello  ")).toBe("hello");
    expect(normalizeText("world")).toBe("world");
  });

  it("returns undefined for empty/whitespace strings", () => {
    expect(normalizeText("")).toBeUndefined();
    expect(normalizeText("   ")).toBeUndefined();
  });

  it("returns undefined for non-string types", () => {
    expect(normalizeText(null)).toBeUndefined();
    expect(normalizeText(undefined)).toBeUndefined();
    expect(normalizeText(42)).toBeUndefined();
    expect(normalizeText({})).toBeUndefined();
  });
});

describe("normalizeMode", () => {
  it("returns 'oneshot' for oneshot string", () => {
    expect(normalizeMode("oneshot")).toBe("oneshot");
    expect(normalizeMode("ONESHOT")).toBe("oneshot");
    expect(normalizeMode("  oneshot  ")).toBe("oneshot");
  });

  it("returns 'persistent' for everything else", () => {
    expect(normalizeMode("persistent")).toBe("persistent");
    expect(normalizeMode("unknown")).toBe("persistent");
    expect(normalizeMode(null)).toBe("persistent");
    expect(normalizeMode(undefined)).toBe("persistent");
  });
});

describe("normalizeBindingConfig", () => {
  it("returns empty object for non-object input", () => {
    expect(normalizeBindingConfig(null)).toEqual({});
    expect(normalizeBindingConfig("string")).toEqual({});
    expect(normalizeBindingConfig(42)).toEqual({});
  });

  it("normalizes valid config shape", () => {
    const result = normalizeBindingConfig({
      mode: "oneshot",
      cwd: "/tmp/project",
      backend: "acpx",
      label: "My Label",
    });
    expect(result.mode).toBe("oneshot");
    expect(result.cwd).toBe("/tmp/project");
    expect(result.backend).toBe("acpx");
    expect(result.label).toBe("My Label");
  });

  it("strips empty/whitespace fields", () => {
    const result = normalizeBindingConfig({ mode: "  ", cwd: "", backend: "   " });
    expect(result.mode).toBeUndefined();
    expect(result.cwd).toBeUndefined();
    expect(result.backend).toBeUndefined();
  });
});

describe("buildConfiguredAcpSessionKey", () => {
  it("builds deterministic session key with acp:binding pattern", () => {
    const key = buildConfiguredAcpSessionKey(baseSpec);
    expect(key).toMatch(/^agent:main:acp:binding:telegram:default:[0-9a-f]{16}$/);
  });

  it("produces same key for same spec", () => {
    expect(buildConfiguredAcpSessionKey(baseSpec)).toBe(buildConfiguredAcpSessionKey(baseSpec));
  });

  it("produces different keys for different conversationIds", () => {
    const spec2 = { ...baseSpec, conversationId: "-9990000000" };
    expect(buildConfiguredAcpSessionKey(baseSpec)).not.toBe(buildConfiguredAcpSessionKey(spec2));
  });

  it("produces different keys for different channels", () => {
    const spec2 = { ...baseSpec, channel: "discord" as const };
    expect(buildConfiguredAcpSessionKey(baseSpec)).not.toBe(buildConfiguredAcpSessionKey(spec2));
  });
});

describe("parseConfiguredAcpSessionKey", () => {
  it("parses valid acp binding session key", () => {
    const key = buildConfiguredAcpSessionKey(baseSpec);
    const parsed = parseConfiguredAcpSessionKey(key);
    expect(parsed).not.toBeNull();
    expect(parsed?.channel).toBe("telegram");
    expect(parsed?.accountId).toBe("default");
  });

  it("returns null for plain agent session keys", () => {
    expect(parseConfiguredAcpSessionKey("agent:main:main")).toBeNull();
  });

  it("returns null for empty/invalid strings", () => {
    expect(parseConfiguredAcpSessionKey("")).toBeNull();
    expect(parseConfiguredAcpSessionKey("not-a-key")).toBeNull();
  });
});

describe("toConfiguredAcpBindingRecord", () => {
  it("builds binding record with correct bindingId", () => {
    const record = toConfiguredAcpBindingRecord(baseSpec);
    expect(record.bindingId).toBe(
      "config:acp:telegram:default:-1001234567890",
    );
  });

  it("sets status to active", () => {
    const record = toConfiguredAcpBindingRecord(baseSpec);
    expect(record.status).toBe("active");
  });

  it("includes mode in metadata", () => {
    const record = toConfiguredAcpBindingRecord(baseSpec);
    expect(record.metadata?.mode).toBe("persistent");
  });

  it("includes optional backend in metadata when provided", () => {
    const spec = { ...baseSpec, backend: "acpx" };
    const record = toConfiguredAcpBindingRecord(spec);
    expect(record.metadata?.backend).toBe("acpx");
  });

  it("targetSessionKey matches buildConfiguredAcpSessionKey", () => {
    const record = toConfiguredAcpBindingRecord(baseSpec);
    expect(record.targetSessionKey).toBe(buildConfiguredAcpSessionKey(baseSpec));
  });
});
