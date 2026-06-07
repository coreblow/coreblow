import { describe, expect, it } from "vitest";
import {
  projectChatDisplayMessages,
  projectRecentChatDisplayMessages,
  sanitizeChatHistoryMessages,
} from "./chat-display-projection.js";

describe("sanitizeChatHistoryMessages", () => {
  it("suppresses internal assistant control token messages", () => {
    expect(
      sanitizeChatHistoryMessages([
        { role: "user", content: "hello" },
        { role: "assistant", content: [{ type: "text", text: "ANNOUNCE_SKIP" }] },
        { role: "assistant", content: "real reply" },
      ]),
    ).toEqual([{ role: "user", content: "hello" }, { role: "assistant", content: "real reply" }]);
  });

  it("strips display directives and omits embedded media bytes", () => {
    expect(
      sanitizeChatHistoryMessages([
        {
          role: "assistant",
          content: [
            { type: "text", text: "hello [[reply_to_current]]" },
            { type: "image", data: "abcd" },
            { type: "audio", source: { type: "base64", data: "xyz" } },
          ],
        },
      ]),
    ).toEqual([
      {
        role: "assistant",
        content: [
          { type: "text", text: "hello " },
          { type: "image", omitted: true, bytes: 4 },
          { type: "audio", source: { type: "base64", omitted: true, bytes: 3 } },
        ],
      },
    ]);
  });
});

describe("projectChatDisplayMessages", () => {
  it("projects messages after stripping inbound envelopes", () => {
    const messages = projectChatDisplayMessages([
      { role: "user", content: "[Telegram User id:42]\nhello" },
    ]);

    expect(messages[0]?.content).toBe("hello");
  });

  it("limits recent projected messages after filtering", () => {
    expect(
      projectRecentChatDisplayMessages(
        [
          { role: "user", content: "one" },
          { role: "assistant", content: "NO_REPLY" },
          { role: "assistant", content: "two" },
        ],
        { maxMessages: 1, stripEnvelope: false },
      ),
    ).toEqual([{ role: "assistant", content: "two" }]);
  });
});
