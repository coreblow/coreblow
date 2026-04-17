import { ErrorCodes, errorShape, validateSecretsResolveParams, validateSecretsResolveResult } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

export function createSecretsHandlers(params: {
    reloadSecrets: () => Promise<{ warningCount: number }>;
    resolveSecrets: (args: { commandName: string; targetIds: string[] }) => Promise<{
        assignments: Array<{ path: string; pathSegments: string[]; value: unknown }>;
        diagnostics: string[];
        inactiveRefPaths: string[];
    }>;
}): GatewayRequestHandlers {
    return {
        "secrets.reload": async ({ respond }) => {
            try {
                const result = await params.reloadSecrets();
                respond(true, { ok: true, warningCount: result.warningCount }, undefined);
            } catch (err: unknown) {
                respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
            }
        },
        "secrets.resolve": async ({ params: requestParams, respond }) => {
            if (!validateSecretsResolveParams(requestParams)) {
                respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid secrets.resolve params"));
                return;
            }
            const p = requestParams as { commandName: string; targetIds: string[] };
            const commandName = p.commandName.trim();
            if (!commandName) {
                respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "commandName is required"));
                return;
            }

            try {
                const result = await params.resolveSecrets({ commandName, targetIds: p.targetIds });
                const payload = {
                    ok: true,
                    assignments: result.assignments,
                    diagnostics: result.diagnostics,
                    inactiveRefPaths: result.inactiveRefPaths,
                };
                if (!validateSecretsResolveResult(payload)) {
                    throw new Error("secrets.resolve returned invalid payload");
                }
                respond(true, payload, undefined);
            } catch (err: unknown) {
                respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
            }
        }
    };
}
