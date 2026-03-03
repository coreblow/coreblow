/**
 * extensions/browser/src/browser/request-policy.test.ts
 *
 * CoreBlow — Browser Extension: Request-policy Tests
 * Verifies Browser request policy and profile resolution.
 */
import { describe, expect, it } from "vitest";
import {
  isPersistentBrowserProfileMutation,
  normalizeBrowserRequestPath,
  resolveRequestedBrowserProfile,
} from "./request-policy.js";

describe("normalizeBrowserRequestPath", () => {
  it("adds leading slash when missing", () => {
    expect(normalizeBrowserRequestPath("profiles/create")).toBe("/profiles/create");
  });

  it("preserves existing leading slash", () => {
    expect(normalizeBrowserRequestPath("/profiles/create")).toBe("/profiles/create");
  });

  it("strips trailing slashes", () => {
    expect(normalizeBrowserRequestPath("/profiles/")).toBe("/profiles");
    expect(normalizeBrowserRequestPath("/profiles/create/")).toBe("/profiles/create");
  });

  it("handles empty string", () => {
    expect(normalizeBrowserRequestPath("")).toBe("");
    expect(normalizeBrowserRequestPath("   ")).toBe("");
  });

  it("handles root path", () => {
    expect(normalizeBrowserRequestPath("/")).toBe("/");
  });
});

describe("isPersistentBrowserProfileMutation", () => {
  it.each([
    ["POST", "/profiles/create"],
    ["POST", "profiles/create"],
    ["POST", "/reset-profile"],
    ["POST", "reset-profile"],
    ["DELETE", "/profiles/poc"],
  ])("treats %s %s as a persistent profile mutation", (method, path) => {
    expect(isPersistentBrowserProfileMutation(method, path)).toBe(true);
  });

  it.each([
    ["GET", "/profiles"],
    ["GET", "/profiles/poc"],
    ["GET", "/status"],
    ["POST", "/stop"],
    ["DELETE", "/profiles"],
    ["DELETE", "/profiles/poc/tabs"],
  ])("allows non-mutating browser routes for %s %s", (method, path) => {
    expect(isPersistentBrowserProfileMutation(method, path)).toBe(false);
  });
});

describe("resolveRequestedBrowserProfile", () => {
  it("resolves profile from query string", () => {
    expect(
      resolveRequestedBrowserProfile({ query: { profile: "my-profile" } }),
    ).toBe("my-profile");
  });

  it("resolves profile from body", () => {
    expect(
      resolveRequestedBrowserProfile({ body: { profile: "body-profile" } }),
    ).toBe("body-profile");
  });

  it("resolves profile from explicit param", () => {
    expect(
      resolveRequestedBrowserProfile({ profile: "explicit-profile" }),
    ).toBe("explicit-profile");
  });

  it("prefers query over body", () => {
    expect(
      resolveRequestedBrowserProfile({
        query: { profile: "from-query" },
        body: { profile: "from-body" },
      }),
    ).toBe("from-query");
  });

  it("returns undefined when no profile provided", () => {
    expect(resolveRequestedBrowserProfile({})).toBeUndefined();
  });

  it("trims whitespace from profile", () => {
    expect(
      resolveRequestedBrowserProfile({ query: { profile: "  my-profile  " } }),
    ).toBe("my-profile");
  });

  it("returns undefined for empty string profile", () => {
    expect(resolveRequestedBrowserProfile({ profile: "  " })).toBeUndefined();
  });
});
