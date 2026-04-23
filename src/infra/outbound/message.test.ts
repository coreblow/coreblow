import { describe, it, expect } from "vitest";
import {
  sendMessage,
  sendPoll,
  OutboundMessageService,
} from "./message.js";

describe("message — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof sendMessage).toBe("function");
    expect(typeof sendPoll).toBe("function");
    expect(typeof OutboundMessageService).toBe("function");
  });
});
