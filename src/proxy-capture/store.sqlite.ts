import type {
  CaptureEventRecord,
  CaptureQueryPreset,
  CaptureQueryRow,
  CaptureSessionRecord,
  CaptureSessionSummary,
} from "./types.js";

const sessions = new Map<string, CaptureSessionRecord>();
const events: CaptureEventRecord[] = [];

export function createCaptureSession(record: CaptureSessionRecord): CaptureSessionRecord {
  sessions.set(record.id, record);
  return record;
}

export function endCaptureSession(sessionId: string, endedAt = Date.now()): boolean {
  const session = sessions.get(sessionId);
  if (!session) {
    return false;
  }
  sessions.set(sessionId, { ...session, endedAt });
  return true;
}

export function recordCaptureEvent(record: CaptureEventRecord): void {
  events.push(record);
}

export function listCaptureSessionSummaries(): CaptureSessionSummary[] {
  return [...sessions.values()]
    .map((session) => ({
      id: session.id,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      mode: session.mode,
      sourceProcess: session.sourceProcess,
      proxyUrl: session.proxyUrl,
      eventCount: events.filter((event) => event.sessionId === session.id).length,
    }))
    .toSorted((left, right) => right.startedAt - left.startedAt);
}

export function listCaptureEvents(sessionId: string): CaptureEventRecord[] {
  return events.filter((event) => event.sessionId === sessionId);
}

export function queryCapturePreset(
  sessionId: string,
  preset: CaptureQueryPreset,
): CaptureQueryRow[] {
  const rows = listCaptureEvents(sessionId);
  if (preset === "error-bursts") {
    return rows
      .filter((event) => event.kind === "error" || event.status == null || event.status >= 400)
      .map((event) => ({
        ts: event.ts,
        host: event.host ?? null,
        path: event.path ?? null,
        status: event.status ?? null,
        error: event.errorText ?? null,
      }));
  }
  return rows.map((event) => ({
    ts: event.ts,
    kind: event.kind,
    host: event.host ?? null,
    path: event.path ?? null,
  }));
}

export function clearCaptureStoreForTests(): void {
  sessions.clear();
  events.length = 0;
}
