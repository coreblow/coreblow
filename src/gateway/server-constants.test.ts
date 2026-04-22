/**
 * src/gateway/server-constants.test.ts
 *
 * CoreBlow — Gateway Server Constants Tests
 * Verifies size constants and getMaxChatHistoryMessagesBytes accessor.
 */
import { describe, afterEach, expect, it } from "vitest";
import {
  MAX_PAYLOAD_BYTES,
  MAX_BUFFERED_BYTES,
  MAX_PREAUTH_PAYLOAD_BYTES,
  getMaxChatHistoryMessagesBytes,
  __setMaxChatHistoryMessagesBytesForTest,
} from "./server-constants.js";

afterEach(() => {
  __setMaxChatHistoryMessagesBytesForTest(undefined); // reset
});

describe("size constants", () => {
  it("MAX_PAYLOAD_BYTES is 25MB", () => {
    expect(MAX_PAYLOAD_BYTES).toBe(25 * 1024 * 1024);
  });

  it("MAX_BUFFERED_BYTES is 50MB (2x max payload)", () => {
    expect(MAX_BUFFERED_BYTES).toBe(50 * 1024 * 1024);
  });

  it("MAX_PREAUTH_PAYLOAD_BYTES is 64KB", () => {
    expect(MAX_PREAUTH_PAYLOAD_BYTES).toBe(64 * 1024);
  });

  it("MAX_BUFFERED_BYTES equals 2 × MAX_PAYLOAD_BYTES", () => {
    expect(MAX_BUFFERED_BYTES).toBe(2 * MAX_PAYLOAD_BYTES);
  });
});

describe("getMaxChatHistoryMessagesBytes()", () => {
  it("returns a positive number by default", () => {
    const val = getMaxChatHistoryMessagesBytes();
    expect(typeof val).toBe("number");
    expect(val).toBeGreaterThan(0);
  });

  it("returns overridden value after __setMaxChatHistoryMessagesBytesForTest", () => {
    __setMaxChatHistoryMessagesBytesForTest(1234);
    expect(getMaxChatHistoryMessagesBytes()).toBe(1234);
  });

  it("resets to default after passing undefined", () => {
    __setMaxChatHistoryMessagesBytesForTest(999);
    __setMaxChatHistoryMessagesBytesForTest(undefined);
    expect(getMaxChatHistoryMessagesBytes()).toBeGreaterThan(999);
  });
});
