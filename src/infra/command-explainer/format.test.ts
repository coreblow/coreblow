import { describe, expect, it } from "vitest";
import { explainShellCommand } from "./extract.js";
import { formatCommandSpans } from "./format.js";
import type { CommandExplanation, SourceSpan } from "./types.js";

function span(startIndex: number, endIndex: number): SourceSpan {
  return {
    startIndex,
    endIndex,
    startPosition: { row: 0, column: startIndex },
    endPosition: { row: 0, column: endIndex },
  };
}

describe("formatCommandSpans", () => {
  it("returns executable token spans", async () => {
    const explanation = await explainShellCommand("FOO=1 python -c 'print(1)'");
    expect(formatCommandSpans(explanation)).toEqual([{ startIndex: 6, endIndex: 12 }]);
  });

  it("ignores invalid executable spans", () => {
    const explanation: CommandExplanation = {
      ok: true,
      source: "echo hi",
      shapes: [],
      topLevelCommands: [
        {
          context: "top-level",
          executable: "echo",
          argv: ["echo", "hi"],
          text: "echo hi",
          span: span(0, 7),
          executableSpan: span(4, 4),
        },
      ],
      nestedCommands: [],
      risks: [],
    };

    expect(formatCommandSpans(explanation)).toStrictEqual([]);
  });
});
