import { describe, it, expect } from "vitest";
import {
  rewriteTranscriptEntriesInSessionManager,
  rewriteTranscriptEntriesInSessionFile,
} from "./transcript-rewrite.js";

describe("transcript-rewrite — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof rewriteTranscriptEntriesInSessionManager).toBe("function");
    expect(typeof rewriteTranscriptEntriesInSessionFile).toBe("function");
  });
});
