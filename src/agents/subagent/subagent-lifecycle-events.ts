export type SubagentLifecycleEndedReason = "complete" | "error" | "killed" | "timeout" | "session_reset" | "session_delete";
export const SUBAGENT_ENDED_REASON_COMPLETE: SubagentLifecycleEndedReason = "complete";
export const SUBAGENT_ENDED_REASON_ERROR: SubagentLifecycleEndedReason = "error";
export const SUBAGENT_ENDED_REASON_KILLED: SubagentLifecycleEndedReason = "killed";
export const SUBAGENT_ENDED_REASON_TIMEOUT: SubagentLifecycleEndedReason = "timeout";
export const SUBAGENT_ENDED_REASON_SESSION_RESET: SubagentLifecycleEndedReason = 'session_reset';
export const SUBAGENT_ENDED_REASON_SESSION_DELETE: SubagentLifecycleEndedReason = 'session_delete';


export const SUBAGENT_ENDED_OUTCOME_OK = 'ok';
export const SUBAGENT_ENDED_OUTCOME_RESET = 'reset';
export const SUBAGENT_ENDED_OUTCOME_DELETED = 'deleted';
export const SUBAGENT_ENDED_OUTCOME_ERROR = 'error';
export const SUBAGENT_ENDED_OUTCOME_TIMEOUT = 'timeout';
export const SUBAGENT_ENDED_OUTCOME_KILLED = 'killed';
export type SubagentLifecycleEndedOutcome = 'ok' | 'reset' | 'deleted' | 'error' | 'timeout' | 'killed';
