import { describe, expect, it } from "vitest";
import { createCronServiceState } from "./service/state.js";

function makeMinimalDeps() {
  return {
    storePath: "/tmp/coreblow-cron-state.json",
    nowMs: () => Date.now(),
    cronEnabled: false,
  } as never;
}

describe("createCronServiceState()", () => {
  it("returns a non-null object", () => {
    const state = createCronServiceState(makeMinimalDeps());
    expect(typeof state).toBe("object");
    expect(state).not.toBeNull();
  });

  it("state.running is false initially", () => {
    const state = createCronServiceState(makeMinimalDeps());
    expect(state.running).toBe(false);
  });

  it("state.timer is null initially", () => {
    const state = createCronServiceState(makeMinimalDeps());
    expect(state.timer).toBeNull();
  });

  it("state.op is a Promise", () => {
    const state = createCronServiceState(makeMinimalDeps());
    expect(state.op).toBeInstanceOf(Promise);
  });

  it("state.deps.storePath matches provided storePath", () => {
    const state = createCronServiceState(makeMinimalDeps());
    expect(state.deps.storePath).toBe("/tmp/coreblow-cron-state.json");
  });

  it("state.store is null initially", () => {
    const state = createCronServiceState(makeMinimalDeps());
    expect(state.store).toBeNull();
  });
});
