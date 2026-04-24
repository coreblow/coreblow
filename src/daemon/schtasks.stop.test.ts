import { describe, it, expect } from "vitest";

import { resolveTaskScriptPath, readScheduledTaskCommand, parseSchtasksQuery, deriveScheduledTaskRuntimeStatus, stageScheduledTask, installScheduledTask, uninstallScheduledTask, stopScheduledTask, restartScheduledTask, isScheduledTaskInstalled, readScheduledTaskRuntime } from "./schtasks.js";

describe("Scheduled Task stop/restart cleanup", () => {
  it("resolves all imports without errors", () => {
    expect(resolveTaskScriptPath).toBeDefined();
    expect(readScheduledTaskCommand).toBeDefined();
    expect(parseSchtasksQuery).toBeDefined();
    expect(deriveScheduledTaskRuntimeStatus).toBeDefined();
    expect(stageScheduledTask).toBeDefined();
    expect(installScheduledTask).toBeDefined();
    expect(uninstallScheduledTask).toBeDefined();
    expect(stopScheduledTask).toBeDefined();
    expect(restartScheduledTask).toBeDefined();
    expect(isScheduledTaskInstalled).toBeDefined();
    expect(readScheduledTaskRuntime).toBeDefined();
  });

  it.todo("kills lingering verified gateway listeners after schtasks stop");
  it.todo("force-kills remaining busy port listeners when the first stop pass does not free the port");
  it.todo("falls back to inspected gateway listeners when sync verification misses on Windows");
  it.todo("kills lingering verified gateway listeners and waits for port release before restart");
});
