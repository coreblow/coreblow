import { describe, expect, it } from "vitest";
import {
  appendHeartbeatFileDirectives,
  buildHeartbeatTasksPrompt,
  isHeartbeatTaskDue,
  parseHeartbeatTasks,
  resolveDueHeartbeatTasks,
  stripHeartbeatTasksBlock,
} from "./heartbeat-tasks.js";

describe("heartbeat tasks", () => {
  it("parses structured tasks from HEARTBEAT.md", () => {
    expect(
      parseHeartbeatTasks(`
# Runbook

tasks:
  - name: deploy-status
    interval: 5m
    prompt: "Check deployment status"
  - name: billing
    interval: '1h'
    prompt: Check billing alerts

Notes remain prose.
`),
    ).toEqual([
      { name: "deploy-status", interval: "5m", prompt: "Check deployment status" },
      { name: "billing", interval: "1h", prompt: "Check billing alerts" },
    ]);
  });

  it("ignores incomplete task entries", () => {
    expect(
      parseHeartbeatTasks(`
tasks:
  - name: missing-prompt
    interval: 5m
  - name: complete
    interval: 1m
    prompt: Run it
`),
    ).toEqual([{ name: "complete", interval: "1m", prompt: "Run it" }]);
  });

  it("resolves due state from last run timestamps", () => {
    expect(isHeartbeatTaskDue(undefined, "5m", 1_000)).toBe(true);
    expect(isHeartbeatTaskDue(0, "5m", 299_999)).toBe(false);
    expect(isHeartbeatTaskDue(0, "5m", 300_000)).toBe(true);
    expect(isHeartbeatTaskDue(0, "not-a-duration", 300_000)).toBe(false);
    expect(
      resolveDueHeartbeatTasks({
        tasks: [
          { name: "due", interval: "5m", prompt: "Due" },
          { name: "later", interval: "1h", prompt: "Later" },
        ],
        heartbeatTaskState: { due: 0, later: 0 },
        nowMs: 300_000,
      }),
    ).toEqual([{ name: "due", interval: "5m", prompt: "Due" }]);
  });

  it("strips tasks block while preserving prose directives", () => {
    const stripped = stripHeartbeatTasksBlock(`
# Heartbeat

tasks:
  - name: status
    interval: 5m
    prompt: Check status

Only notify for urgent changes.
`);

    expect(stripped).toContain("# Heartbeat");
    expect(stripped).toContain("Only notify for urgent changes.");
    expect(stripped).not.toContain("Check status");
  });

  it("appends non-task directives and builds task prompts", () => {
    const prompt = buildHeartbeatTasksPrompt({
      tasks: [{ name: "status", interval: "5m", prompt: "Check deployment status" }],
      useHeartbeatResponseTool: true,
    });
    const withDirectives = appendHeartbeatFileDirectives(
      prompt,
      `
tasks:
  - name: status
    interval: 5m
    prompt: Check deployment status
Only notify for urgent changes.
`,
    );

    expect(withDirectives).toContain("Run the following periodic tasks");
    expect(withDirectives).toContain("- status: Check deployment status");
    expect(withDirectives).toContain("heartbeat_respond");
    expect(withDirectives).toContain("Only notify for urgent changes.");
  });
});
