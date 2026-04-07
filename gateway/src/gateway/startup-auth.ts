import { planCredentialResolution } from "./credential-planner.js";
import { resolveGatewayConnectionAuthFromConfig } from "./connection-auth.js";
import type { CoreBlowConfig, GatewayLogger } from "./gateway-types.js";

export function validateStartupAuth(cfg: CoreBlowConfig, log: GatewayLogger): boolean {
    const plan = planCredentialResolution(cfg);
    log.info(`Gateway starting with auth mode: ${plan.mode}`);
    
    if (plan.mode === "none") {
        log.warn("GATEWAY IS RUNNING IN NO-AUTH MODE. THIS IS INSECURE FOR PRODUCTION!");
        return true;
    }

    const credentials = resolveGatewayConnectionAuthFromConfig({ config: cfg });
    if (plan.mode === "token" && !credentials.token) {
        log.error("Gateway configured for token auth but no token provided.");
        return false;
    }

    if (plan.mode === "password" && !credentials.password) {
        log.error("Gateway configured for password auth but no password provided.");
        return false;
    }

    return true;
}
