import { describe, expect, it } from "vitest";
import {
  CHUTES_TOKEN_ENDPOINT,
  CHUTES_USERINFO_ENDPOINT,
  exchangeChutesCodeForTokens,
  refreshChutesTokens,
} from "./chutes-oauth.js";

function mockFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
): typeof globalThis.fetch {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    return handler(url, init);
  };
}

function createStoredCredential(
  now: number,
): Parameters<typeof refreshChutesTokens>[0]["credential"] {
  return {
    access: "at_old",
    refresh: "rt_old",
    expires: now - 10_000,
    email: "fred",
    clientId: "cid_test",
  } as unknown as Parameters<typeof refreshChutesTokens>[0]["credential"];
}

describe("chutes-oauth", () => {
  it("exchanges code for tokens and stores username as email", async () => {
    const fetchFn = mockFetch(async (url, init) => {
      if (url === CHUTES_TOKEN_ENDPOINT) {
        expect(init?.method).toBe("POST");
        return new Response(
          JSON.stringify({
            access_token: "at_123",
            refresh_token: "rt_123",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url === CHUTES_USERINFO_ENDPOINT) {
        return new Response(
          JSON.stringify({ username: "testuser", email: "testuser@example.com" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    });

    const result = await exchangeChutesCodeForTokens({
      code: "auth_code_123",
      verifier: "pkce_verifier",
      redirectUri: "http://localhost:9999/callback",
      fetchFn,
    });

    expect(result.access).toBe("at_123");
    expect(result.refresh).toBe("rt_123");
    expect(typeof result.expires).toBe("number");
  });

  it("refreshes expired tokens using refresh_token", async () => {
    const now = Date.now();
    const credential = createStoredCredential(now);

    const fetchFn = mockFetch(async (url) => {
      if (url === CHUTES_TOKEN_ENDPOINT) {
        return new Response(
          JSON.stringify({
            access_token: "at_new",
            expires_in: 1800,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    });

    const refreshed = await refreshChutesTokens({ credential, fetchFn });

    expect(refreshed.access).toBe("at_new");
    expect(refreshed.refresh).toBe("rt_old");
    expect(refreshed.expires).toBeGreaterThan(now);
  });

  it("throws on non-200 token endpoint response", async () => {
    const now = Date.now();
    const credential = createStoredCredential(now);

    const fetchFn = mockFetch(async () => {
      return new Response(JSON.stringify({ error: "invalid_grant" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    });

    await expect(refreshChutesTokens({ credential, fetchFn })).rejects.toThrow();
  });
});
