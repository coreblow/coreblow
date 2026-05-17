import { describe, expect, it } from "vitest";
import { formatConsoleTimestamp } from "./console.js";

describe("console-timestamp", () => {
  it("pretty style returns local HH:MM:SS with timezone offset", () => {
    expect(formatConsoleTimestamp("pretty")).toMatch(/^\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  });

  it("compact style returns local ISO-like timestamp with timezone offset", () => {
    expect(formatConsoleTimestamp("compact")).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/,
    );
  });

  it("json style returns local ISO-like timestamp with timezone offset", () => {
    expect(formatConsoleTimestamp("json")).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/,
    );
  });

  it.todo("timestamp contains the correct local date components");
});
