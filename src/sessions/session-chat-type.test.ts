import { describe, expect, it } from "vitest";
import { deriveSessionChatType } from "./session-chat-type.js";

describe("deriveSessionChatType", () => {
  it.each([
    ["agent:main:telegram:direct:123", "direct"],
    ["agent:main:telegram:group:123", "group"],
    ["agent:main:discord:guild-1:channel-2", "channel"],
    ["whatsapp:123@g.us", "group"],
    ["agent:main:whatsapp:123@g.us", "group"],
    ["", "unknown"],
  ] as const)("derives %s as %s", (key, expected) => {
    expect(deriveSessionChatType(key)).toBe(expected);
  });
});
