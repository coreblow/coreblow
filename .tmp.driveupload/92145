import type { GatewayCredentialMode } from "./credentials.js";
import { resolveGatewayCredentialsFromConfig } from "./credentials.js";
import type { ConnectionAuthOptions } from "./gateway-types.js";

export async function resolveGatewayConnectionAuthWithSecretInputs(options: ConnectionAuthOptions): Promise<{ token?: string; password?: string }> {
    // In CoreBlow we skip complex secret resolution for now
    // Fallback to config resolution
    return resolveGatewayCredentialsFromConfig(options);
}

export async function resolveGatewayConnectionAuth(
    params: ConnectionAuthOptions
): Promise<{ token?: string; password?: string }> {
    return await resolveGatewayConnectionAuthWithSecretInputs({
        ...params,
        cfg: params.config
    });
}

export function resolveGatewayConnectionAuthFromConfig(
    params: ConnectionAuthOptions
): { token?: string; password?: string } {
    return resolveGatewayCredentialsFromConfig({ ...params, cfg: params.config });
}
