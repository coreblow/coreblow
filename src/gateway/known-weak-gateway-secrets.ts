import type { ResolvedGatewayAuth } from "./auth.js";

export const KNOWN_WEAK_GATEWAY_TOKEN_PLACEHOLDERS = [
  "change-me-to-a-long-random-token",
  "change-me-now",
] as const;

export const KNOWN_WEAK_GATEWAY_PASSWORD_PLACEHOLDERS = [
  "change-me-to-a-strong-password",
] as const;

const KNOWN_WEAK_GATEWAY_TOKENS: ReadonlySet<string> = new Set(
  KNOWN_WEAK_GATEWAY_TOKEN_PLACEHOLDERS,
);

const KNOWN_WEAK_GATEWAY_PASSWORDS: ReadonlySet<string> = new Set(
  KNOWN_WEAK_GATEWAY_PASSWORD_PLACEHOLDERS,
);

export function assertGatewayAuthNotKnownWeak(auth: ResolvedGatewayAuth): void {
  if (auth.mode === "token") {
    const token = auth.token?.trim() ?? "";
    if (token && KNOWN_WEAK_GATEWAY_TOKENS.has(token)) {
      throw new Error(
        "Invalid config: gateway auth token is set to a published example placeholder " +
          "from docs or .env.example. Generate a real secret (e.g. `openssl rand -hex 32`) " +
          "and set COREBLOW_GATEWAY_TOKEN or gateway.auth.token before starting the gateway.",
      );
    }
    return;
  }

  if (auth.mode === "password") {
    const password = auth.password?.trim() ?? "";
    if (password && KNOWN_WEAK_GATEWAY_PASSWORDS.has(password)) {
      throw new Error(
        "Invalid config: gateway auth password is set to the example placeholder " +
          "from .env.example. Choose a real password and set COREBLOW_GATEWAY_PASSWORD " +
          "or gateway.auth.password before starting the gateway.",
      );
    }
  }
}
