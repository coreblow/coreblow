import type { IncomingMessage, ServerResponse } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedGatewayAuth } from "./auth.js";
import {
  authorizeGatewayHttpRequestOrReply,
  checkGatewayHttpRequestAuth,
  resolveOpenAiCompatibleHttpOperatorScopes,
  resolveTrustedHttpOperatorScopes,
} from "./http-auth-utils.js";

vi.mock("./auth.js", () => ({
  authorizeHttpGatewayConnect: vi.fn(),
}));

vi.mock("./http-common.js", () => ({
  sendGatewayAuthFailure: vi.fn(),
  sendMissingScopeForbidden: vi.fn(),
}));

const { authorizeHttpGatewayConnect } = await import("./auth.js");
const { sendGatewayAuthFailure } = await import("./http-common.js");

function createReq(headers: Record<string, string> = {}): IncomingMessage {
  return { headers } as IncomingMessage;
}

const tokenAuth = {
  mode: "token",
  token: "secret",
  allowTailscale: false,
} satisfies ResolvedGatewayAuth;

describe("checkGatewayHttpRequestAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks successful shared-secret bearer requests as not trusting declared scopes", async () => {
    vi.mocked(authorizeHttpGatewayConnect).mockResolvedValue({ ok: true, method: "token" });

    const result = await checkGatewayHttpRequestAuth({
      req: createReq({ authorization: "Bearer secret" }),
      auth: tokenAuth,
    });

    expect(result).toEqual({
      ok: true,
      requestAuth: { authMethod: "token", trustDeclaredOperatorScopes: false },
    });
    expect(authorizeHttpGatewayConnect).toHaveBeenCalledWith(
      expect.objectContaining({ connectAuth: { token: "secret", password: "secret" } }),
    );
  });

  it("replies on failed authentication", async () => {
    vi.mocked(authorizeHttpGatewayConnect).mockResolvedValue({
      ok: false,
      reason: "token_mismatch",
    });
    const res = {} as ServerResponse;

    await expect(
      authorizeGatewayHttpRequestOrReply({
        req: createReq({ authorization: "Bearer wrong" }),
        res,
        auth: tokenAuth,
      }),
    ).resolves.toBeNull();
    expect(sendGatewayAuthFailure).toHaveBeenCalledWith(
      res,
      expect.objectContaining({ reason: "token_mismatch" }),
    );
  });
});

describe("HTTP operator scopes", () => {
  it("does not trust bearer clients to self-declare scopes on general HTTP surfaces", () => {
    expect(
      resolveTrustedHttpOperatorScopes(
        createReq({
          authorization: "Bearer secret",
          "x-coreblow-scopes": "operator.admin",
        }),
        tokenAuth,
      ),
    ).toEqual([]);
  });

  it("restores normal defaults for OpenAI-compatible shared-secret requests", () => {
    expect(
      resolveOpenAiCompatibleHttpOperatorScopes(createReq(), {
        authMethod: "token",
        trustDeclaredOperatorScopes: false,
      }),
    ).toEqual([
      "operator.admin",
      "operator.read",
      "operator.write",
      "operator.approvals",
      "operator.pairing",
    ]);
  });
});
