import { describe, expect, it } from "vitest";
import entry from "./index.js";

describe("twitch bundled entry", () => {
  it("exposes the Twitch channel entry", () => {
    expect(entry.id).toBe("twitch");
    expect(entry.name).toBe("Twitch");
  });
});
