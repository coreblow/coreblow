import { describe, it, expect } from "vitest";

import { resolveTaskScriptPath, readScheduledTaskCommand, parseSchtasksQuery, deriveScheduledTaskRuntimeStatus, stageScheduledTask, installScheduledTask, uninstallScheduledTask, stopScheduledTask, restartScheduledTask, isScheduledTaskInstalled, readScheduledTaskRuntime } from "./schtasks.js";

describe("Windows startup fallback", () => {
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

  it.todo("falls back to a Startup-folder launcher when schtasks create is denied");
  it.todo("falls back to a Startup-folder launcher when schtasks create hangs");
  it.todo("treats an installed Startup-folder launcher as loaded");
  it.todo("reports runtime from the gateway listener when using the Startup fallback");
  it.todo("restarts the Startup fallback by killing the current pid and relaunching the entry");
  it.todo("kills the Startup fallback runtime even when the CLI env omits the gateway port");
});
