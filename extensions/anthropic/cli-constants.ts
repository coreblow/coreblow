export const CLAUDE_CLI_BACKEND_ID = "claude-cli";
export const CLAUDE_CLI_DEFAULT_MODEL_REF = `${CLAUDE_CLI_BACKEND_ID}/claude-opus-4-6`;
export const CLAUDE_CLI_DEFAULT_ALLOWLIST_REFS = [
  CLAUDE_CLI_DEFAULT_MODEL_REF,
  `${CLAUDE_CLI_BACKEND_ID}/claude-sonnet-4-6`,
  `${CLAUDE_CLI_BACKEND_ID}/claude-opus-4-5`,
  `${CLAUDE_CLI_BACKEND_ID}/claude-sonnet-4-5`,
  `${CLAUDE_CLI_BACKEND_ID}/claude-haiku-4-5`,
] as const;

export {
  CLAUDE_CLI_MODEL_ALIASES,
  CLAUDE_CLI_SESSION_ID_FIELDS,
} from "./cli-shared.js";
