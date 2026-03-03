import { describe, expect, it } from "vitest";
import { hasWsSession, releaseWsSession } from "./openai-ws-stream.js";

describe("openai-ws-stream session management", () => {
  it("reports no session for unknown ids", () => {
    expect(hasWsSession("nonexistent-session-id")).toBe(false);
  });

  it("release is safe for unknown sessions", () => {
    expect(() => releaseWsSession("nonexistent-session-id")).not.toThrow();
  });
});
