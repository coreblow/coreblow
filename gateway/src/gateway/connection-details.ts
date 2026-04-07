import type { IncomingMessage } from 'node:http';

export interface ClientConnectionDetails {
    ip: string;
    userAgent: string;
    clientId: string;
    deviceType: string;
}

export function extractConnectionDetails(req: IncomingMessage): ClientConnectionDetails {
    const ip = req.socket?.remoteAddress || req.headers?.['x-forwarded-for'] || "unknown";
    const userAgent = req.headers?.['user-agent'] || "unknown";
    
    // Attempt to extract client ID from headers or query
    const clientId = req.headers?.['x-client-id'] || "anonymous";
    const deviceType = req.headers?.['x-device-type'] || "unknown";

    return {
        ip: Array.isArray(ip) ? ip[0] : ip,
        userAgent,
        clientId: Array.isArray(clientId) ? clientId[0] : clientId,
        deviceType: Array.isArray(deviceType) ? deviceType[0] : deviceType,
    };
}
