import { describe, it, expect } from "vitest";
import { normalizeHttpWebhookUrl } from "./webhook-url.js";

describe("normalizeHttpWebhookUrl", () => {
  it("accepts valid HTTP URLs", () => {
    expect(normalizeHttpWebhookUrl("http://localhost:8080/webhook")).toBe("http://localhost:8080/webhook");
    expect(normalizeHttpWebhookUrl("http://example.com")).toBe("http://example.com");
  });

  it("accepts valid HTTPS URLs", () => {
    expect(normalizeHttpWebhookUrl("https://api.example.com/hook")).toBe("https://api.example.com/hook");
  });

  it("trims whitespace", () => {
    expect(normalizeHttpWebhookUrl("  https://example.com  ")).toBe("https://example.com");
  });

  it("rejects non-HTTP(S) protocols", () => {
    expect(normalizeHttpWebhookUrl("ftp://example.com")).toBeNull();
    expect(normalizeHttpWebhookUrl("ws://example.com")).toBeNull();
    expect(normalizeHttpWebhookUrl("file:///etc/passwd")).toBeNull();
  });

  it("rejects non-string values", () => {
    expect(normalizeHttpWebhookUrl(null)).toBeNull();
    expect(normalizeHttpWebhookUrl(undefined)).toBeNull();
    expect(normalizeHttpWebhookUrl(123)).toBeNull();
    expect(normalizeHttpWebhookUrl({})).toBeNull();
  });

  it("rejects empty strings", () => {
    expect(normalizeHttpWebhookUrl("")).toBeNull();
    expect(normalizeHttpWebhookUrl("   ")).toBeNull();
  });

  it("rejects invalid URLs", () => {
    expect(normalizeHttpWebhookUrl("not-a-url")).toBeNull();
    expect(normalizeHttpWebhookUrl("://missing-scheme")).toBeNull();
  });
});
