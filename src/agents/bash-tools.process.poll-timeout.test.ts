import { afterEach, describe, expect, it } from "vitest";
import { resetDiagnosticSessionStateForTest } from "../logging/diagnostic-session-state.js";
import {
  addSession,
  appendOutput,
  markExited,
  resetProcessRegistryForTests,
} from "./bash-process-registry.js";
import { createProcessSessionFixture } from "./bash-process-registry.test-helpers.js";
import { createProcessTool } from "./bash-tools.process.js";

afterEach(() => {
  resetProcessRegistryForTests();
  resetDiagnosticSessionStateForTest();
});

function createProcessSessionHarness(sessionId: string) {
  const processTool = createProcessTool();
  const session = createProcessSessionFixture({
    id: sessionId,
    command: "test",
    backgrounded: true,
  });
  addSession(session);
  return { processTool, session };
}

async function pollSession(
  processTool: ReturnType<typeof createProcessTool>,
  callId: string,
  sessionId: string,
  timeout?: number | string,
) {
  return processTool.execute(callId, {
    action: "poll",
    sessionId,
    ...(timeout === undefined ? {} : { timeout }),
  });
}

function pollStatus(result: Awaited<ReturnType<ReturnType<typeof createProcessTool>["execute"]>>) {
  return (result.details as { status?: string }).status;
}

describe("process tool poll timeout", () => {
  it("returns running status for active process", async () => {
    const { processTool, session } = createProcessSessionHarness("test-poll-1");
    // appendOutput in CB takes (session, stream, chunk)
    appendOutput(session, "stdout", "some output\n");

    const result = await pollSession(processTool, "poll-1", session.id);
    expect(pollStatus(result)).toBe("running");
  });

  it("returns completed status after process exits", async () => {
    const { processTool, session } = createProcessSessionHarness("test-poll-2");
    appendOutput(session, "stdout", "done\n");
    markExited(session, 0, null, "completed");

    const result = await pollSession(processTool, "poll-2", session.id);
    expect(pollStatus(result)).toMatch(/completed|done|exited|ok/i);
  });

  it("returns error text for unknown session", async () => {
    const processTool = createProcessTool();
    const result = await processTool.execute("poll-unknown", {
      action: "poll",
      sessionId: "nonexistent-session-id",
    });

    // CB returns "No session found for ..." style message
    const text = result.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("");
    expect(text.toLowerCase()).toMatch(/session|found|nonexistent/i);
  });

  it("accepts custom timeout parameter without throwing", async () => {
    const { processTool, session } = createProcessSessionHarness("test-poll-timeout");
    appendOutput(session, "stdout", "output\n");

    const result = await pollSession(processTool, "poll-t", session.id, 100);
    expect(result).toBeDefined();
  });
});
