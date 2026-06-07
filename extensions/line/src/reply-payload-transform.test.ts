import { describe, expect, it } from "vitest";
import { parseLineDirectives } from "./reply-payload-transform.js";

describe("line reply payload transform", () => {
  it("extracts quick reply directives", () => {
    expect(
      parseLineDirectives({ text: "Pick [[quick_replies: One, Two]]" }).channelData?.line,
    ).toMatchObject({ quickReplies: ["One", "Two"] });
  });
});
