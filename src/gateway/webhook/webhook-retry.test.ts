import { describe, it, expect } from "vitest";
import { webhookWithRetry } from "./webhook-retry.js";

describe("webhookWithRetry", () => {
  it("succeeds on first attempt with ok response", async () => {
    const mockFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({ ok: true, status: 200 })) as any;

    try {
      const result = await webhookWithRetry("https://example.com/webhook", { event: "test" }, 1);
      expect(result).toBeDefined();
      expect((result as any).ok).toBe(true);
    } finally {
      globalThis.fetch = mockFetch;
    }
  });

  it("retries on non-ok response and eventually throws", async () => {
    const mockFetch = globalThis.fetch;
    let attempts = 0;
    globalThis.fetch = (async () => {
      attempts++;
      return { ok: false, status: 500 };
    }) as any;

    try {
      await expect(webhookWithRetry("https://example.com/webhook", { data: 1 }, 2)).rejects.toThrow(
        "Webhook delivery failed",
      );
      expect(attempts).toBe(3); // initial + 2 retries
    } finally {
      globalThis.fetch = mockFetch;
    }
  });

  it("retries on fetch error (network failure)", async () => {
    const mockFetch = globalThis.fetch;
    let attempts = 0;
    globalThis.fetch = (async () => {
      attempts++;
      throw new Error("network error");
    }) as any;

    try {
      await expect(webhookWithRetry("https://example.com/webhook", {}, 1)).rejects.toThrow(
        "Webhook delivery failed",
      );
      expect(attempts).toBe(2); // initial + 1 retry
    } finally {
      globalThis.fetch = mockFetch;
    }
  });

  it("succeeds after transient failures", async () => {
    const mockFetch = globalThis.fetch;
    let attempts = 0;
    globalThis.fetch = (async () => {
      attempts++;
      if (attempts < 3) return { ok: false, status: 503 };
      return { ok: true, status: 200 };
    }) as any;

    try {
      const result = await webhookWithRetry("https://example.com/webhook", {}, 3);
      expect((result as any).ok).toBe(true);
      expect(attempts).toBe(3);
    } finally {
      globalThis.fetch = mockFetch;
    }
  });
});
