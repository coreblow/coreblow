import { describe, expect, it } from "vitest";
import {
  rewriteCopilotConnectionBoundResponseIds,
  rewriteCopilotResponsePayloadConnectionBoundIds,
  sanitizeCopilotReplayResponseIds,
} from "./connection-bound-ids.js";

describe("github-copilot connection-bound response IDs", () => {
  it("rewrites opaque message response item IDs deterministically", () => {
    const originalId = Buffer.from(`message-${"x".repeat(24)}`).toString("base64");
    const first = [{ id: originalId, type: "message" }];
    const second = [{ id: originalId, type: "message" }];

    expect(rewriteCopilotConnectionBoundResponseIds(first)).toBe(true);
    expect(rewriteCopilotConnectionBoundResponseIds(second)).toBe(true);
    expect(first[0]?.id).toMatch(/^msg_[a-f0-9]{16}$/);
    expect(first[0]?.id).toBe(second[0]?.id);
  });

  it("drops unsafe reasoning replay items", () => {
    const overlongId = `5PX6gLHXT5wE+Y2tPmUV4gn+${"B".repeat(384)}`;
    const input = [
      { id: overlongId, type: "reasoning", encrypted_content: "encrypted", summary: [] },
      { id: "rs_valid", type: "reasoning", encrypted_content: "valid", summary: [] },
    ];

    expect(sanitizeCopilotReplayResponseIds(input)).toBe(true);
    expect(input).toEqual([
      { id: "rs_valid", type: "reasoning", encrypted_content: "valid", summary: [] },
    ]);
  });

  it("patches response payload input arrays only", () => {
    const messageId = Buffer.from(`message-${"m".repeat(24)}`).toString("base64");
    const payload = { input: [{ id: messageId, type: "message" }] };

    expect(rewriteCopilotResponsePayloadConnectionBoundIds(payload)).toBe(true);
    expect(payload.input[0]?.id).toMatch(/^msg_[a-f0-9]{16}$/);
    expect(rewriteCopilotResponsePayloadConnectionBoundIds({ input: "text" })).toBe(false);
  });
});
