import type { IncomingMessage, ServerResponse } from "node:http";
import type { AuthRateLimiter } from "./auth-rate-limit.js";
import type { ResolvedGatewayAuth } from "./auth.js";
import { authorizeGatewayHttpRequestOrReply, getHeader } from "./http-auth-utils.js";

const OPERATOR_SCOPES_HEADER = "x-coreblow-scopes";

export async function authorizeGatewayBearerRequestOrReply(params: {
  req: IncomingMessage;
  res: ServerResponse;
  auth: ResolvedGatewayAuth;
  trustedProxies?: string[];
  allowRealIpFallback?: boolean;
  rateLimiter?: AuthRateLimiter;
}): Promise<boolean> {
  return (
    (await authorizeGatewayHttpRequestOrReply({
      req: params.req,
      res: params.res,
      auth: params.auth,
      trustedProxies: params.trustedProxies,
      allowRealIpFallback: params.allowRealIpFallback,
      rateLimiter: params.rateLimiter,
    })) !== null
  );
}

export function resolveGatewayRequestedOperatorScopes(req: IncomingMessage): string[] {
  const raw = getHeader(req, OPERATOR_SCOPES_HEADER)?.trim();
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);
}
