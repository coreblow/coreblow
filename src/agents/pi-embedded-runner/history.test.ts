import { describe, expect, it } from "vitest";
import { getHistoryLimitFromSessionKey, limitHistoryTurns } from "./history.js";

describe("getHistoryLimitFromSessionKey", () => {
  it("returns undefined when session key is missing", () => {
    expect(getHistoryLimitFromSessionKey(undefined, {} as any)).toBeUndefined();
  });

  it("returns undefined when config is missing", () => {
    expect(getHistoryLimitFromSessionKey("agent:main:slack:channel:gen", undefined)).toBeUndefined();
  });
});

describe("limitHistoryTurns", () => {
  it("limits message array to the specified turn count", () => {
    const messages = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "user", content: "how are you?" },
      { role: "assistant", content: "fine" },
      { role: "user", content: "cool" },
      { role: "assistant", content: "thanks" },
    ];
    const limited = limitHistoryTurns(messages as any, 2);
    expect(limited.length).toBeLessThanOrEqual(4);
  });

  it("returns all messages when limit exceeds length", () => {
    const messages = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ];
    const limited = limitHistoryTurns(messages as any, 100);
    expect(limited.length).toBe(2);
  });
});
