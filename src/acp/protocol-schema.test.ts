import { PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import { zInitializeRequest, zPromptRequest } from "@agentclientprotocol/sdk/dist/schema/zod.gen.js";
import { describe, expect, it } from "vitest";

describe("ACP SDK protocol schemas", () => {
  it("validates representative initialize and prompt payloads", () => {
    expect(
      zInitializeRequest.safeParse({
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
      }).success,
    ).toBe(true);
    expect(
      zPromptRequest.safeParse({
        sessionId: "session-1",
        prompt: [{ type: "text", text: "hello" }],
      }).success,
    ).toBe(true);
    expect(zPromptRequest.safeParse({ sessionId: "session-1", prompt: [{ type: "text" }] }).success).toBe(false);
  });
});
