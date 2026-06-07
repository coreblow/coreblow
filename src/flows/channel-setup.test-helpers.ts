import type { WizardPrompter } from "../wizard/prompts.js";

export type ChannelSetupPromptRecord =
  | { kind: "confirm"; message: string }
  | { kind: "note"; message: string; title?: string }
  | { kind: "select"; message: string }
  | { kind: "text"; message: string };

export function createChannelSetupTestPrompter(params?: {
  confirm?: boolean;
  select?: string;
  text?: string;
}): WizardPrompter & { records: ChannelSetupPromptRecord[] } {
  const records: ChannelSetupPromptRecord[] = [];
  return {
    records,
    confirm: async (prompt) => {
      records.push({ kind: "confirm", message: prompt.message });
      return params?.confirm ?? true;
    },
    note: async (message, title) => {
      records.push({ kind: "note", message, title });
    },
    select: async (prompt) => {
      records.push({ kind: "select", message: prompt.message });
      return params?.select ?? String(prompt.initialValue ?? prompt.options[0]?.value ?? "");
    },
    text: async (prompt) => {
      records.push({ kind: "text", message: prompt.message });
      return params?.text ?? "";
    },
  } as WizardPrompter & { records: ChannelSetupPromptRecord[] };
}
