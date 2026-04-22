import { describe, expect, it, vi } from "vitest";
import { createCronServiceState } from "./service/state.js";
import { emit } from "./service/timer.js";

function makeStateWithEvents(onEvent?: (evt: unknown) => void) {
  return createCronServiceState({
    storePath: "/tmp/events-test.json",
    nowMs: () => Date.now(),
    cronEnabled: false,
    onEvent,
  } as never);
}

describe("CronService event emission", () => {
  it("onEvent is called when emit is invoked", () => {
    const onEvent = vi.fn();
    const state = makeStateWithEvents(onEvent);
    emit(state, { type: "job-run" } as never);
    expect(onEvent).toHaveBeenCalledTimes(1);
  });

  it("onEvent receives the event object", () => {
    const received: unknown[] = [];
    const state = makeStateWithEvents((e) => received.push(e));
    const evt = { type: "job-complete", jobId: "j1" };
    emit(state, evt as never);
    expect(received[0]).toEqual(evt);
  });

  it("multiple events are dispatched in order", () => {
    const log: string[] = [];
    const state = makeStateWithEvents((e) => log.push((e as never as { type: string }).type));
    emit(state, { type: "start" } as never);
    emit(state, { type: "run" } as never);
    emit(state, { type: "done" } as never);
    expect(log).toEqual(["start", "run", "done"]);
  });

  it("no onEvent does not throw", () => {
    const state = makeStateWithEvents();
    expect(() => emit(state, { type: "any" } as never)).not.toThrow();
  });
});
