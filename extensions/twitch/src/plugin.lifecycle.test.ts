import { describe, expect, it } from "vitest";
import { twitchPlugin } from "./plugin.js";

describe("twitch plugin lifecycle", () => {
  it("exposes a gateway start hook", () => {
    expect(typeof twitchPlugin.gateway?.startAccount).toBe("function");
  });
});
