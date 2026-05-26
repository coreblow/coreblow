import { afterEach, describe, expect, test } from "vitest";
import { agentCommand } from "./test-helpers.mocks.js";
import { readAgentCommandCall, waitForAgentCommandCall } from "./agent-command.test-helpers.js";

afterEach(() => {
  agentCommand.mockReset();
});

describe("agent command test helpers", () => {
  test("reads a command call by run id", async () => {
    agentCommand({ runId: "run-1", prompt: "hello" });
    agentCommand({ runId: "run-2", prompt: "bye" });

    await expect(readAgentCommandCall({ runId: "run-1" })).resolves.toMatchObject({
      runId: "run-1",
      prompt: "hello",
    });
  });

  test("reads command calls from the end", async () => {
    agentCommand({ runId: "run-1", prompt: "first" });
    agentCommand({ runId: "run-2", prompt: "second" });

    await expect(readAgentCommandCall({ fromEnd: 1 })).resolves.toMatchObject({
      runId: "run-2",
      prompt: "second",
    });
  });

  test("waits until the command call is recorded", async () => {
    setTimeout(() => {
      agentCommand({ runId: "run-later", prompt: "later" });
    }, 10);

    await expect(waitForAgentCommandCall("run-later")).resolves.toMatchObject({
      runId: "run-later",
      prompt: "later",
    });
  });
});
