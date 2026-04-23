import { describe, it, expect } from "vitest";
import {
  resolveLinkChannelContext,
} from "./status.link-channel.js";

describe("status.link-channel — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof resolveLinkChannelContext).toBe("function");
  });
});
