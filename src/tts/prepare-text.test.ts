import { describe, expect, it } from "vitest";
import { stripMarkdown } from "../shared/text/strip-markdown.js";

describe("prepare-text", () => {
  it("strips markdown headers before TTS", () => {
    expect(stripMarkdown("# Status\n\nReady")).toBe("Status\n\nReady");
  });

  it("strips bold and italic markers before TTS", () => {
    expect(stripMarkdown("Use **CoreBlow** with _voice_ replies.")).toBe(
      "Use CoreBlow with voice replies.",
    );
  });

  it("strips inline code markers before TTS", () => {
    expect(stripMarkdown("Run `coreblow doctor` first.")).toBe("Run coreblow doctor first.");
  });

  it("handles a typical LLM reply with mixed markdown", () => {
    const input = [
      "## Plan",
      "",
      "- Start **CoreBlow**",
      "> Then run `coreblow status`",
      "",
      "---",
      "",
      "Done.",
    ].join("\n");

    expect(stripMarkdown(input)).toBe(
      ["Plan", "", "- Start CoreBlow", "Then run coreblow status", "", "Done."].join("\n"),
    );
  });

  it.todo("handles markdown-heavy system design explanation");
});
