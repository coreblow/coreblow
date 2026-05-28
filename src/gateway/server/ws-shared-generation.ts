import { createHash } from "node:crypto";
import type { GatewayTrustedProxyConfig } from "../../config/types.gateway.js";
import type { ResolvedGatewayAuth } from "../auth.js";

type SharedSecret = {
  mode: "token" | "password";
  secret: string;
};

function resolveSharedSecret(auth: ResolvedGatewayAuth): SharedSecret | null {
  // trim() is only a blank-value guard; generation must hash the exact raw secret bytes.
  if (auth.mode === "token" && typeof auth.token === "string" && auth.token.trim().length > 0) {
    return { mode: "token", secret: auth.token };
  }
  if (
    auth.mode === "password" &&
    typeof auth.password === "string" &&
    auth.password.trim().length > 0
  ) {
    return { mode: "password", secret: auth.password };
  }
  return null;
}

function normalizeTrustedProxyConfig(
  trustedProxy: GatewayTrustedProxyConfig | undefined,
): {
  userHeader: string | undefined;
  requiredHeaders: string[];
  allowUsers: string[];
} {
  return {
    userHeader: trustedProxy?.userHeader,
    requiredHeaders: [...(trustedProxy?.requiredHeaders ?? [])].toSorted(),
    allowUsers: [...(trustedProxy?.allowUsers ?? [])].toSorted(),
  };
}

export function resolveSharedGatewaySessionGeneration(
  auth: ResolvedGatewayAuth,
  trustedProxies?: readonly string[],
): string | undefined {
  const shared = resolveSharedSecret(auth);
  if (shared) {
    return createHash("sha256")
      .update(`${shared.mode}\u0000${shared.secret}`, "utf8")
      .digest("base64url");
  }
  if (auth.mode === "trusted-proxy") {
    return createHash("sha256")
      .update(
        JSON.stringify({
          mode: auth.mode,
          trustedProxy: normalizeTrustedProxyConfig(auth.trustedProxy),
          trustedProxies: [...(trustedProxies ?? [])].toSorted(),
        }),
        "utf8",
      )
      .digest("base64url");
  }
  return undefined;
}
