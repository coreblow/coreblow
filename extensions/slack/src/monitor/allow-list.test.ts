/**
 * extensions/slack/src/monitor/allow-list.test.ts
 *
 * CoreBlow — Slack Extension: Allow-list Tests
 * Verifies Allow-list normalization and user permission resolution.
 */
import { describe, expect, it } from "vitest";
import {
  normalizeAllowList,
  normalizeAllowListLower,
  normalizeSlackSlug,
  resolveSlackAllowListMatch,
  resolveSlackUserAllowed,
} from "./allow-list.js";

describe("normalizeSlackSlug", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(normalizeSlackSlug("Team Space")).toBe("team-space");
  });

  it("normalizes special chars", () => {
    expect(normalizeSlackSlug(" #Ops.Room ")).toBe("#ops.room");
  });

  it("handles undefined", () => {
    expect(normalizeSlackSlug(undefined)).toBe("");
  });

  it("handles empty string", () => {
    expect(normalizeSlackSlug("")).toBe("");
  });
});

describe("normalizeAllowList", () => {
  it("trims strings and excludes empty entries", () => {
    expect(normalizeAllowList(["  Alice  ", 7, "", "  "])).toEqual(["Alice", "7"]);
  });

  it("returns empty array for undefined", () => {
    expect(normalizeAllowList(undefined)).toEqual([]);
  });
});

describe("normalizeAllowListLower", () => {
  it("lowercases and trims entries", () => {
    expect(normalizeAllowListLower(["  Alice  ", 7])).toEqual(["alice", "7"]);
  });
});

describe("resolveSlackAllowListMatch", () => {
  it("matches wildcard '*'", () => {
    expect(
      resolveSlackAllowListMatch({ allowList: ["*"], id: "u1", name: "alice" }),
    ).toMatchObject({ allowed: true, matchSource: "wildcard" });
  });

  it("matches by id", () => {
    expect(
      resolveSlackAllowListMatch({ allowList: ["u1"], id: "u1", name: "alice" }),
    ).toMatchObject({ allowed: true, matchKey: "u1", matchSource: "id" });
  });

  it("does not match prefixed name without allowNameMatching", () => {
    expect(
      resolveSlackAllowListMatch({ allowList: ["slack:alice"], id: "u2", name: "alice" }),
    ).toEqual({ allowed: false });
  });

  it("matches prefixed name when allowNameMatching is true", () => {
    expect(
      resolveSlackAllowListMatch({
        allowList: ["slack:alice"],
        id: "u2",
        name: "alice",
        allowNameMatching: true,
      }),
    ).toMatchObject({ allowed: true, matchSource: "prefixed-name" });
  });

  it("returns not-allowed for unmatched entries", () => {
    expect(
      resolveSlackAllowListMatch({ allowList: ["u2"], id: "u1", name: "alice" }),
    ).toEqual({ allowed: false });
  });
});

describe("resolveSlackUserAllowed", () => {
  it("allows all users when allowList is empty", () => {
    expect(resolveSlackUserAllowed({ allowList: [], userId: "u1", userName: "alice" })).toBe(true);
  });

  it("allows user in list", () => {
    expect(
      resolveSlackUserAllowed({ allowList: ["u1"], userId: "u1", userName: "alice" }),
    ).toBe(true);
  });

  it("denies user not in list", () => {
    expect(
      resolveSlackUserAllowed({ allowList: ["u2"], userId: "u1", userName: "alice" }),
    ).toBe(false);
  });
});
