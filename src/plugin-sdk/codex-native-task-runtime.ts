// Private helper surface for the bundled Codex plugin. This is intentionally
// local-only so Codex can mirror app-server native subagents into CoreBlow's
// task registry without promoting detached task mutation helpers to the public
// plugin SDK.

// Constants ported from tasks/codex-native-subagent-task.ts
export const CODEX_NATIVE_SUBAGENT_RUNTIME = "subagent";
export const CODEX_NATIVE_SUBAGENT_TASK_KIND = "codex-native";
export const CODEX_NATIVE_SUBAGENT_RUN_ID_PREFIX = "codex-thread:";
export const CODEX_NATIVE_SUBAGENT_STALE_ERROR = "Codex native subagent stopped reporting progress";
