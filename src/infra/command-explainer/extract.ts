import { splitShellArgs } from "../../utils/shell-argv.js";
import { detectInlineEvalArgv } from "../command-analysis/risks.js";
import { extractShellWrapperInlineCommand, isShellWrapperExecutable } from "../shell-wrapper-resolution.js";
import type { CommandExplanation, CommandRisk, CommandShape, CommandStep, SourceSpan } from "./types.js";

function span(source: string, startIndex: number, endIndex: number): SourceSpan {
  const prefix = source.slice(0, startIndex);
  const row = (prefix.match(/\n/gu) ?? []).length;
  const column = prefix.length - (prefix.lastIndexOf("\n") + 1);
  return {
    startIndex,
    endIndex,
    startPosition: { row, column },
    endPosition: { row, column: column + Math.max(0, endIndex - startIndex) },
  };
}

function splitTopLevel(source: string): Array<{ text: string; start: number }> {
  const parts: Array<{ text: string; start: number }> = [];
  let start = 0;
  for (const match of source.matchAll(/\s*(?:&&|\|\||[|;])\s*/gu)) {
    const text = source.slice(start, match.index).trim();
    if (text) {
      parts.push({ text, start: source.indexOf(text, start) });
    }
    start = match.index + match[0].length;
  }
  const tail = source.slice(start).trim();
  if (tail) {
    parts.push({ text: tail, start: source.indexOf(tail, start) });
  }
  return parts;
}

function shapesForSource(source: string): CommandShape[] {
  const shapes = new Set<CommandShape>();
  if (source.includes("|")) {
    shapes.add("pipeline");
  }
  if (source.includes("&&")) {
    shapes.add("and");
  }
  if (source.includes("||")) {
    shapes.add("or");
  }
  if (source.includes(";")) {
    shapes.add("sequence");
  }
  return [...shapes];
}

function commandStep(source: string, text: string, start: number, context: CommandStep["context"]): CommandStep | null {
  const argv = splitShellArgs(text);
  if (!argv?.[0]) {
    return null;
  }
  const executable = argv.find((token) => !/^[A-Za-z_][A-Za-z0-9_]*=/u.test(token));
  if (!executable) {
    return null;
  }
  const executableStart = source.indexOf(executable, start);
  const executableEnd = executableStart + executable.length;
  return {
    context,
    executable,
    argv,
    text,
    span: span(source, start, start + text.length),
    executableSpan: span(source, executableStart, executableEnd),
  };
}

function risksForStep(source: string, step: CommandStep): CommandRisk[] {
  const risks: CommandRisk[] = [];
  const inline = detectInlineEvalArgv(step.argv);
  if (inline) {
    risks.push({
      kind: "inline-eval",
      command: inline.normalizedExecutable,
      flag: inline.flag,
      text: step.text,
      span: step.span,
    });
  }
  const payload = extractShellWrapperInlineCommand(step.argv);
  if (payload && isShellWrapperExecutable(step.argv[0] ?? "")) {
    risks.push({
      kind: "shell-wrapper",
      executable: step.argv[0] ?? "",
      flag: "-c",
      payload,
      text: step.text,
      span: step.span,
    });
    const nestedArgv = splitShellArgs(payload);
    const nestedInline = nestedArgv ? detectInlineEvalArgv(nestedArgv) : null;
    if (nestedInline) {
      risks.push({
        kind: "inline-eval",
        command: nestedInline.normalizedExecutable,
        flag: nestedInline.flag,
        text: payload,
        span: span(source, source.indexOf(payload), source.indexOf(payload) + payload.length),
      });
    }
  }
  return risks;
}

export async function explainShellCommand(source: string): Promise<CommandExplanation> {
  const topLevelCommands = splitTopLevel(source)
    .map((part) => commandStep(source, part.text, part.start, "top-level"))
    .filter((entry): entry is CommandStep => entry !== null);
  return {
    ok: true,
    source,
    shapes: shapesForSource(source),
    topLevelCommands,
    nestedCommands: [],
    risks: topLevelCommands.flatMap((step) => risksForStep(source, step)),
  };
}
