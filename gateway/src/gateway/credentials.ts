import type { CredentialResolveOptions } from "./gateway-types.js";

export type GatewayCredentialMode = "token" | "password" | "none";
export type GatewayCredentialPrecedence = "cli" | "env" | "config" | "default";
export type GatewayRemoteCredentialFallback = "allow" | "deny";
export type GatewayRemoteCredentialPrecedence = "cli" | "env" | "config";

export interface GatewayCredentials {
    mode: GatewayCredentialMode;
    token?: string;
    password?: string;
}

export function resolveGatewayCredentialsFromConfig(options: CredentialResolveOptions): { token?: string; password?: string } {
    const cfg = options.cfg ?? options.config;
    const auth = cfg?.gateway?.auth;
    const authRecord = auth as Record<string, unknown> | undefined;
    const mode = options.modeOverride || (authRecord?.mode as string) || "none";
    if (mode === "none") return {};
    
    return {
        token: (authRecord?.token as string | undefined) || process.env.GATEWAY_TOKEN,
        password: (authRecord?.password as string | undefined) || process.env.GATEWAY_PASSWORD
    };
}
