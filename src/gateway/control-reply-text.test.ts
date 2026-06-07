import { describe, expect, it } from "vitest";
import {
  isSuppressedControlReplyLeadFragment,
  isSuppressedControlReplyText,
} from "./control-reply-text.js";

describe("isSuppressedControlReplyText", () => {
  it.each(["NO_REPLY", " ANNOUNCE_SKIP ", "\nREPLY_SKIP\n"])(
    "suppresses the internal token %s",
    (text) => {
      expect(isSuppressedControlReplyText(text)).toBe(true);
    },
  );

  it("keeps substantive messages containing a control token", () => {
    expect(isSuppressedControlReplyText("Reply: REPLY_SKIP")).toBe(false);
  });
});

describe("isSuppressedControlReplyLeadFragment", () => {
  it.each(["NO", "NO_", "ANN", "ANNOUNCE_", "REP", "REPLY_"])(
    "suppresses streamed control fragment %s",
    (text) => {
      expect(isSuppressedControlReplyLeadFragment(text)).toBe(true);
    },
  );

  it.each(["Ann", "Rep", "REPLY_SKIP", "normal reply"])(
    "keeps visible text %s",
    (text) => {
      expect(isSuppressedControlReplyLeadFragment(text)).toBe(false);
    },
  );

  it("suppresses short No while streaming so a partial NO_REPLY does not leak", () => {
    expect(isSuppressedControlReplyLeadFragment("No")).toBe(true);
  });
});
