import { describe, expect, it } from "vitest";
import { formatCliFailureLines } from "./failure-output.js";

describe("formatCliFailureLines", () => {
  it("shows a concise reason and recovery commands by default", () => {
    const lines = formatCliFailureLines({
      title: "Could not start the CLI.",
      error: new Error("config file is invalid"),
      argv: ["node", "coreblow", "status"],
      env: {},
    });

    expect(lines).toEqual([
      "[coreblow] Could not start the CLI.",
      "[coreblow] Reason: config file is invalid",
      "[coreblow] Debug: set COREBLOW_DEBUG=1 to include the stack trace.",
      "[coreblow] Try: `coreblow doctor`",
      "[coreblow] Help: `coreblow --help`",
    ]);
  });

  it("prints stack details when debug output is requested", () => {
    const lines = formatCliFailureLines({
      title: "The CLI command failed.",
      error: new Error("boom"),
      env: { COREBLOW_DEBUG: "1" },
    });

    expect(lines.slice(0, 4)).toEqual([
      "[coreblow] The CLI command failed.",
      "[coreblow] Reason: boom",
      "[coreblow] Stack:",
      "[coreblow] Error: boom",
    ]);
    expect(lines.join("\n")).toContain("Error: boom");
  });
});
