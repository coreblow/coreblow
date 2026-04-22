import { describe, expect, it } from "vitest";
import { parseSlackBlocksInput, validateSlackBlocksArray } from "./blocks-input.js";

describe("parseSlackBlocksInput", () => {
  it("returns undefined when blocks are missing", () => {
    expect(parseSlackBlocksInput(undefined)).toBeUndefined();
    expect(parseSlackBlocksInput(null)).toBeUndefined();
  });

  it("accepts blocks arrays directly", () => {
    const parsed = parseSlackBlocksInput([{ type: "divider" }]);
    expect(parsed).toEqual([{ type: "divider" }]);
  });

  it("accepts JSON blocks strings", () => {
    const parsed = parseSlackBlocksInput(
      '[{"type":"section","text":{"type":"mrkdwn","text":"hi"}}]',
    );
    expect(parsed).toEqual([{ type: "section", text: { type: "mrkdwn", text: "hi" } }]);
  });

  it("rejects invalid JSON strings", () => {
    expect(() => parseSlackBlocksInput("{bad-json")).toThrow(/valid JSON/i);
  });

  it("rejects non-array payload", () => {
    expect(() => parseSlackBlocksInput({ type: "divider" })).toThrow(/array/i);
  });

  it("rejects empty array", () => {
    expect(() => parseSlackBlocksInput([])).toThrow(/at least one block/i);
  });

  it("rejects non-object block elements", () => {
    expect(() => parseSlackBlocksInput(["not-a-block"])).toThrow(/object/i);
  });

  it("rejects blocks missing type field", () => {
    expect(() => parseSlackBlocksInput([{}])).toThrow(/non-empty string type/i);
  });

  it("rejects blocks with empty type", () => {
    expect(() => parseSlackBlocksInput([{ type: "  " }])).toThrow(/non-empty string type/i);
  });

  it("accepts multiple valid blocks", () => {
    const result = parseSlackBlocksInput([
      { type: "section", text: { type: "mrkdwn", text: "Hello" } },
      { type: "divider" },
    ]);
    expect(result).toHaveLength(2);
  });
});

describe("validateSlackBlocksArray", () => {
  it("validates and returns valid array", () => {
    const result = validateSlackBlocksArray([{ type: "section" }]);
    expect(result).toEqual([{ type: "section" }]);
  });

  it("throws on empty array", () => {
    expect(() => validateSlackBlocksArray([])).toThrow(/at least one block/i);
  });
});
