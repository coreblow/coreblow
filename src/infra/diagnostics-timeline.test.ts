import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  emitDiagnosticsTimelineEvent,
  flushDiagnosticsTimelineForTest,
  isDiagnosticsTimelineEnabled,
  measureDiagnosticsTimelineSpan,
  measureDiagnosticsTimelineSpanSync,
} from "./diagnostics-timeline.js";

const tempDirs: string[] = [];

async function createTimelineEnv() {
  const dir = await mkdtemp(join(tmpdir(), "coreblow-diagnostics-timeline-"));
  tempDirs.push(dir);
  return {
    env: {
      COREBLOW_DIAGNOSTICS: "timeline",
      COREBLOW_DIAGNOSTICS_RUN_ID: "run-1",
      COREBLOW_DIAGNOSTICS_TIMELINE_PATH: join(dir, "nested", "timeline.jsonl"),
    } as NodeJS.ProcessEnv,
    path: join(dir, "nested", "timeline.jsonl"),
  };
}

async function readTimeline(path: string) {
  await flushDiagnosticsTimelineForTest();
  return (await readFile(path, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("diagnostics timeline", () => {
  it("detects when timeline output is enabled", async () => {
    const { env } = await createTimelineEnv();
    expect(isDiagnosticsTimelineEnabled({ env })).toBe(true);
    expect(isDiagnosticsTimelineEnabled({ env: { ...env, COREBLOW_DIAGNOSTICS: "0" } })).toBe(false);
  });

  it("writes JSONL diagnostic events with the stable envelope", async () => {
    const { env, path } = await createTimelineEnv();
    emitDiagnosticsTimelineEvent(
      { type: "mark", name: "gateway.ready", phase: "startup", attributes: { ok: true, ignored: Number.NaN } },
      { env },
    );
    const [event] = await readTimeline(path);
    expect(event?.schemaVersion).toBe("coreblow.diagnostics.v1");
    expect(event?.type).toBe("mark");
    const attributes = event?.attributes as Record<string, unknown> | undefined;
    expect(attributes?.ok).toBe(true);
    expect(attributes?.ignored).toBeUndefined();
  });

  it("records async and sync spans", async () => {
    const { env, path } = await createTimelineEnv();
    await expect(measureDiagnosticsTimelineSpan("runtime.stage", () => "ok", { env })).resolves.toBe("ok");
    expect(measureDiagnosticsTimelineSpanSync("runtime.sync", () => 42, { env })).toBe(42);
    const events = await readTimeline(path);
    expect(events.map((event) => event.type)).toEqual([
      "span.start",
      "span.end",
      "span.start",
      "span.end",
    ]);
  });
});
