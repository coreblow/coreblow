import type { IncomingMessage, ServerResponse } from "node:http";

export type HttpHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void> | void;

export interface HttpEndpoint {
    method: "GET" | "POST" | "PUT" | "DELETE" | "*";
    pathPrefix: string;
    handler: HttpHandler;
}

export function createEndpoint(method: HttpEndpoint["method"], pathPrefix: string, handler: HttpHandler): HttpEndpoint {
    return { method, pathPrefix, handler };
}
