import { describe, it, expect } from "vitest";

import { resolveTaskScriptPath, readScheduledTaskCommand, parseSchtasksQuery, deriveScheduledTaskRuntimeStatus, stageScheduledTask, installScheduledTask, uninstallScheduledTask, stopScheduledTask, restartScheduledTask, isScheduledTaskInstalled, readScheduledTaskRuntime } from "./schtasks.js";

describe("installScheduledTask", () => {
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

  it.todo("writes quoted set assignments and escapes metacharacters");
  it.todo("rejects line breaks in command arguments, env vars, and descriptions");
  it.todo("does not persist a frozen PATH snapshot into the generated task script");
});
