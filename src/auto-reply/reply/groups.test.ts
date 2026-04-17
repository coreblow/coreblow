import { describe, expect, it } from "vitest";
import {
  defaultGroupActivation,
  buildGroupChatContext,
} from "./groups.js";

describe("auto-reply groups", () => {
  it("returns 'mention' activation when requireMention is true", () => {
    expect(defaultGroupActivation(true)).toBe("mention");
  });

  it("returns 'always' activation when requireMention is false", () => {
    expect(defaultGroupActivation(false)).toBe("always");
  });
});
