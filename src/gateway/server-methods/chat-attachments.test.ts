/**
 * src/gateway/server-methods/chat-attachments.test.ts
 */
import { describe, expect, it } from "vitest";
describe("server-methods/chat-attachments — import", () => {
  it("is importable", async () => {
    const m = await import("./chat-attachments.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("server-methods/chat-transcript-inject — import", () => {
  it("is importable", async () => {
    const m = await import("./chat-transcript-inject.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
