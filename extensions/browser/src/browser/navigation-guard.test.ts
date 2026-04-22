import { describe, expect, it, vi } from "vitest";
import {
  assertBrowserNavigationAllowed,
  InvalidBrowserNavigationUrlError,
  requiresInspectableBrowserNavigationRedirects,
  withBrowserNavigationPolicy,
} from "./navigation-guard.js";

describe("withBrowserNavigationPolicy", () => {
  it("returns empty object when no ssrfPolicy", () => {
    expect(withBrowserNavigationPolicy()).toEqual({});
    expect(withBrowserNavigationPolicy(undefined)).toEqual({});
  });

  it("wraps ssrfPolicy in object", () => {
    const policy = { allowPrivateNetworks: true } as any;
    expect(withBrowserNavigationPolicy(policy)).toEqual({ ssrfPolicy: policy });
  });
});

describe("requiresInspectableBrowserNavigationRedirects", () => {
  it("returns true when no policy (private network blocked by default)", () => {
    expect(requiresInspectableBrowserNavigationRedirects(undefined)).toBe(true);
  });

  it("returns false when private networks are allowed", () => {
    expect(
      requiresInspectableBrowserNavigationRedirects({ allowPrivateNetwork: true } as any),
    ).toBe(false);
  });
});

describe("assertBrowserNavigationAllowed", () => {
  it("allows about:blank", async () => {
    await expect(
      assertBrowserNavigationAllowed({ url: "about:blank" }),
    ).resolves.toBeUndefined();
  });

  it("blocks file URLs", async () => {
    await expect(
      assertBrowserNavigationAllowed({ url: "file:///etc/passwd" }),
    ).rejects.toBeInstanceOf(InvalidBrowserNavigationUrlError);
  });

  it("blocks data URLs", async () => {
    await expect(
      assertBrowserNavigationAllowed({ url: "data:text/html,<h1>owned</h1>" }),
    ).rejects.toBeInstanceOf(InvalidBrowserNavigationUrlError);
  });

  it("blocks javascript URLs", async () => {
    await expect(
      assertBrowserNavigationAllowed({ url: "javascript:alert(1)" }),
    ).rejects.toBeInstanceOf(InvalidBrowserNavigationUrlError);
  });

  it("blocks empty URL", async () => {
    await expect(
      assertBrowserNavigationAllowed({ url: "" }),
    ).rejects.toBeInstanceOf(Error);
  });

  it("allows https URLs with custom lookup (private IP bypass)", async () => {
    const lookupFn = vi.fn(async () => [{ address: "1.2.3.4", family: 4 }]) as any;
    await expect(
      assertBrowserNavigationAllowed({
        url: "https://example.com",
        lookupFn,
        ssrfPolicy: { allowPrivateNetworks: true } as any,
      }),
    ).resolves.toBeUndefined();
  });
});
