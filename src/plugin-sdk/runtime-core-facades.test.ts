import { describe, expect, it } from "vitest";
import { chunkText } from "./reply-chunking.js";
import { generateSecureToken } from "./secure-random-runtime.js";
import { normalizeStringEntriesLower } from "./string-normalization-runtime.js";

describe("plugin SDK core runtime facades", () => {
  it("exposes chunking, secure random, and normalization helpers", () => {
    expect(chunkText("abcdef", 3)).toEqual(["abc", "def"]);
    expect(generateSecureToken(8)).toMatch(/^[A-Za-z0-9_-]{11}$/);
    expect(normalizeStringEntriesLower([" A ", "B"])).toEqual(["a", "b"]);
  });
});
