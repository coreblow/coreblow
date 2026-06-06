export type CommandContext = "top-level" | "wrapper-payload";
export type CommandShape = "pipeline" | "and" | "or" | "sequence";

export type SourceSpan = {
  startIndex: number;
  endIndex: number;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
};

export type CommandStep = {
  context: CommandContext;
  executable: string;
  argv: string[];
  text: string;
  span: SourceSpan;
  executableSpan: SourceSpan;
};

export type CommandRisk =
  | { kind: "inline-eval"; command: string; flag: string; text: string; span: SourceSpan }
  | { kind: "shell-wrapper"; executable: string; flag: string; payload: string; text: string; span: SourceSpan };

export type CommandExplanation = {
  ok: boolean;
  source: string;
  shapes: CommandShape[];
  topLevelCommands: CommandStep[];
  nestedCommands: CommandStep[];
  risks: CommandRisk[];
};
