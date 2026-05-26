import type { CoreBlowConfig } from "../config/config.js";

// Module-level tracker of sessions that received `session_start` but not yet a
// paired `session_end`. The gateway close handler drains this set on shutdown
// or restart so downstream session_end plugins can finalize active sessions.
export type ActiveSessionForShutdown = {
  cfg: CoreBlowConfig;
  sessionKey: string;
  sessionId: string;
  storePath: string;
  sessionFile?: string;
  agentId?: string;
};

const trackedSessions = new Map<string, ActiveSessionForShutdown>();

export function noteActiveSessionForShutdown(entry: ActiveSessionForShutdown): void {
  if (!entry.sessionId) {
    return;
  }
  trackedSessions.set(entry.sessionId, entry);
}

export function forgetActiveSessionForShutdown(sessionId: string | undefined): void {
  if (!sessionId) {
    return;
  }
  trackedSessions.delete(sessionId);
}

export function listActiveSessionsForShutdown(): ActiveSessionForShutdown[] {
  return Array.from(trackedSessions.values());
}

export function clearActiveSessionsForShutdownTracker(): void {
  trackedSessions.clear();
}
