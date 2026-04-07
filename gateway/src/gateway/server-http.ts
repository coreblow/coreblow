import type { IncomingMessage, ServerResponse } from "node:http";
import type { HttpEndpoint } from "./http-endpoint-helpers.js";
import { sendJsonResponse } from "./http-utils.js";

// Import modules
import { modelsEndpoint } from "./models-http.js";
import { sessionsHistoryEndpoint } from "./sessions-history-http.js";
import { sessionKillEndpoint } from "./session-kill-http.js";

// In CoreBlow we export standard HTTP handlers mapping
export const httpEndpoints: HttpEndpoint[] = [
    modelsEndpoint,
    sessionsHistoryEndpoint,
    sessionKillEndpoint
];

export function handleHttpRequest(req: IncomingMessage, res: ServerResponse) {
    if (!req.url) {
        return sendJsonResponse(res, 400, { error: "bad request" });
    }

    const { pathname } = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    
    // Prefix matching and method matching
    for (const endpoint of httpEndpoints) {
        if ((endpoint.method === "*" || endpoint.method === req.method) && pathname.startsWith(endpoint.pathPrefix)) {
            return endpoint.handler(req, res);
        }
    }

    sendJsonResponse(res, 404, { error: "not found" });
}
