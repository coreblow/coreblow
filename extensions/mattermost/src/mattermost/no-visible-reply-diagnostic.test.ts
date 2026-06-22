import { describe, expect, it } from "vitest";
import {
  evaluateMattermostNoVisibleReply,
  formatMattermostNoVisibleReplyLog,
} from "./no-visible-reply-diagnostic.js";

describe("evaluateMattermostNoVisibleReply", () => {
  it("flags substantive text payloads that delivered empty", () => {
    const violation = evaluateMattermostNoVisibleReply({
      outcome: "empty",
      payload: { text: "Here is the result of the work I did..." },
    });
    expect(violation).toStrictEqual({
      reason: "no-visible-reply-after-final-delivery",
      outcome: "empty",
      finalTextLength: "Here is the result of the work I did...".length,
      mediaUrlCount: 0,
    });
  });

  it("follows the SDK legacy media fallback when counting media URLs", () => {
    const violation = evaluateMattermostNoVisibleReply({
      outcome: "empty",
      payload: {
        mediaUrl: "https://example.org/a.png",
        mediaUrls: ["https://example.org/b.png", "https://example.org/c.png"],
      },
    });
    expect(violation?.mediaUrlCount).toBe(2);
  });

  it("does not flag empty outcome when the payload was nominally empty", () => {
    expect(
      evaluateMattermostNoVisibleReply({
        outcome: "empty",
        payload: {},
      }),
    ).toBeNull();
  });
});

describe("formatMattermostNoVisibleReplyLog", () => {
  it("emits a grep-friendly single-line diagnostic", () => {
    const line = formatMattermostNoVisibleReplyLog({
      violation: {
        reason: "no-visible-reply-after-final-delivery",
        outcome: "empty",
        finalTextLength: 137,
        mediaUrlCount: 0,
      },
      to: "channel:town-square",
      accountId: "default",
      agentId: "main",
    });
    expect(line).toBe(
      "mattermost no-visible-reply: no-visible-reply-after-final-delivery" +
        " to=channel:town-square" +
        " accountId=default" +
        " agentId=main" +
        " outcome=empty" +
        " finalTextLength=137" +
        " mediaUrlCount=0",
    );
  });
});
