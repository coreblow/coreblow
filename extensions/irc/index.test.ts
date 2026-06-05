import { describe, expect, it } from "vitest";
import entry from "./index.js";

describe("irc bundled entry", () => {
  it("exposes the IRC channel entry", () => {
    expect(entry.id).toBe("irc");
    expect(entry.name).toBe("IRC");
  });
});
