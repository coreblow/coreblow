import type { CommandExplanation } from "./types.js";

export type CommandSpan = {
  startIndex: number;
  endIndex: number;
};

function isValidSpan(span: { startIndex: number; endIndex: number }): boolean {
  return Number.isSafeInteger(span.startIndex) && span.startIndex >= 0 && span.endIndex > span.startIndex;
}

export function formatCommandSpans(explanation: CommandExplanation): CommandSpan[] {
  return [...explanation.topLevelCommands, ...explanation.nestedCommands]
    .map((command) => command.executableSpan)
    .filter(isValidSpan)
    .map((entry) => ({ startIndex: entry.startIndex, endIndex: entry.endIndex }));
}
