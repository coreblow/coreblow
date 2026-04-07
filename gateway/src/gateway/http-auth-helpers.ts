import type { IncomingMessage } from "node:http";

export function extractBearerToken(req: IncomingMessage): string | null {
    const auth = req.headers.authorization;
    if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
        return null;
    }
    return auth.split(" ")[1]?.trim() || null;
}

export function validateHttpAuth(req: IncomingMessage, validToken: string): boolean {
    const token = extractBearerToken(req);
    return token === validToken;
}
