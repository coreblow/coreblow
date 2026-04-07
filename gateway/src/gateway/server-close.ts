import type { Server as HttpServer } from "node:http";
import type { WebSocketServer } from "ws";

export function createGatewayCloseHandler(params: {
    broadcast: (event: string, payload: unknown) => void;
    clients: Set<{ socket: { close: (code: number, reason: string) => void } }>;
    wss: WebSocketServer;
    httpServer: HttpServer;
    httpServers?: HttpServer[];
}) {
    return async (opts?: { reason?: string; restartExpectedMs?: number | null }) => {
        const reason = opts?.reason || "gateway stopping";
        const restartExpectedMs = opts?.restartExpectedMs ?? null;

        params.broadcast("shutdown", { reason, restartExpectedMs });

        for (const c of params.clients) {
            try { c.socket.close(1012, "service restart"); } catch { }
        }
        params.clients.clear();

        await new Promise<void>(resolve => params.wss.close(() => resolve()));

        const servers = params.httpServers?.length ? params.httpServers : [params.httpServer];
        for (const server of servers) {
            const hs = server as any;
            if (typeof hs.closeIdleConnections === "function") hs.closeIdleConnections();
            await new Promise<void>((resolve, reject) => 
                server.close((err) => err ? reject(err) : resolve())
            );
        }
    };
}
