import { listCaptureEvents } from "./store.sqlite.js";
import type { CaptureObservedDimension, CaptureSessionCoverageSummary } from "./types.js";

function dimension(values: Array<string | undefined>): CaptureObservedDimension[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) {
      continue;
    }
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .toSorted((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}

function readMetaString(metaJson: string | undefined, key: string): string | undefined {
  if (!metaJson) {
    return undefined;
  }
  try {
    const value = (JSON.parse(metaJson) as Record<string, unknown>)[key];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}

export function summarizeCaptureCoverage(sessionId: string): CaptureSessionCoverageSummary {
  const events = listCaptureEvents(sessionId);
  return {
    sessionId,
    totalEvents: events.length,
    unlabeledEventCount: events.filter((event) => !event.metaJson).length,
    providers: dimension(events.map((event) => readMetaString(event.metaJson, "provider"))),
    apis: dimension(events.map((event) => readMetaString(event.metaJson, "api"))),
    models: dimension(events.map((event) => readMetaString(event.metaJson, "model"))),
    hosts: dimension(events.map((event) => event.host)),
    localPeers: dimension(events.map((event) => readMetaString(event.metaJson, "localPeer"))),
  };
}

export function formatCaptureCoverageSummary(summary: CaptureSessionCoverageSummary): string {
  return `[coreblow proxy] debug proxy coverage: ${summary.totalEvents - summary.unlabeledEventCount}/${summary.totalEvents} labeled.`;
}
