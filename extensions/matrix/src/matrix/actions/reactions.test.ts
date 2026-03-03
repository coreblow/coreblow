/**
 * extensions/matrix/src/matrix/actions/reactions.test.ts
 *
 * CoreBlow — Matrix Extension: Reactions Tests
 * Verifies Reaction handling and emoji resolution.
 */
import { describe, expect, it } from "vitest";
import {
  buildMatrixReactionContent,
  buildMatrixReactionRelationsPath,
  MATRIX_ANNOTATION_RELATION_TYPE,
  MATRIX_REACTION_EVENT_TYPE,
  normalizeMatrixReactionEmoji,
  normalizeMatrixReactionMessageId,
} from "../reaction-common.js";

describe("normalizeMatrixReactionMessageId", () => {
  it("trims and returns valid message id", () => {
    expect(normalizeMatrixReactionMessageId("  $abc123  ")).toBe("$abc123");
    expect(normalizeMatrixReactionMessageId("$ev1")).toBe("$ev1");
  });

  it("throws for empty message id", () => {
    expect(() => normalizeMatrixReactionMessageId("")).toThrow("requires a messageId");
    expect(() => normalizeMatrixReactionMessageId("   ")).toThrow("requires a messageId");
  });
});

describe("normalizeMatrixReactionEmoji", () => {
  it("trims and returns valid emoji", () => {
    expect(normalizeMatrixReactionEmoji("  👍  ")).toBe("👍");
    expect(normalizeMatrixReactionEmoji("❤️")).toBe("❤️");
  });

  it("throws for empty emoji", () => {
    expect(() => normalizeMatrixReactionEmoji("")).toThrow("requires an emoji");
    expect(() => normalizeMatrixReactionEmoji("   ")).toThrow("requires an emoji");
  });
});

describe("buildMatrixReactionContent", () => {
  it("builds correct reaction event content", () => {
    const content = buildMatrixReactionContent("$msg1", "👍");
    expect(content["m.relates_to"].rel_type).toBe(MATRIX_ANNOTATION_RELATION_TYPE);
    expect(content["m.relates_to"].event_id).toBe("$msg1");
    expect(content["m.relates_to"].key).toBe("👍");
  });

  it("trims whitespace from messageId and emoji", () => {
    const content = buildMatrixReactionContent("  $msg2  ", "  ❤️  ");
    expect(content["m.relates_to"].event_id).toBe("$msg2");
    expect(content["m.relates_to"].key).toBe("❤️");
  });
});

describe("buildMatrixReactionRelationsPath", () => {
  it("builds correct URL-encoded path", () => {
    const path = buildMatrixReactionRelationsPath("!room:example.org", "$msg");
    expect(path).toContain(encodeURIComponent("!room:example.org"));
    expect(path).toContain(encodeURIComponent("$msg"));
    expect(path).toContain(MATRIX_ANNOTATION_RELATION_TYPE);
    expect(path).toContain(MATRIX_REACTION_EVENT_TYPE);
  });

  it("starts with /_matrix/client/v1/rooms/", () => {
    const path = buildMatrixReactionRelationsPath("!x:y.org", "$ev");
    expect(path).toMatch(/^\/_matrix\/client\/v1\/rooms\//);
  });
});
