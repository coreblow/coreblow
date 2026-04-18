/** CoreBlow — WS Handshake Auth */ export function extractTokenFromHeaders(headers: Headers): string | null { return headers.get("authorization")?.replace("Bearer ", "") ?? null; }
