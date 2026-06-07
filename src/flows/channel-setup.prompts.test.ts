import { describe, expect, it } from "vitest";
import { createChannelSetupTestPrompter } from "./channel-setup.test-helpers.js";

describe("channel setup prompts", () => {
  it("records prompt calls for setup tests", async () => {
    const prompter = createChannelSetupTestPrompter({ confirm: false });
    await prompter.confirm({ message: "Configure channels?" });
    await prompter.note("status", "Channel status");

    expect(prompter.records).toEqual([
      { kind: "confirm", message: "Configure channels?" },
      { kind: "note", message: "status", title: "Channel status" },
    ]);
  });
});
