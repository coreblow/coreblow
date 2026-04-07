import type { IncomingMessage, ServerResponse } from "node:http";

export function parseJsonBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", () => {
            try { resolve(body ? JSON.parse(body) : {}); }
            catch (e) { reject(e); }
        });
        req.on("error", reject);
    });
}

export function sendJsonResponse(res: ServerResponse, statusCode: number, data: unknown) {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
}

export function sendErrorResponse(res: ServerResponse, statusCode: number, message: string) {
    sendJsonResponse(res, statusCode, { error: { message, code: statusCode } });
}
