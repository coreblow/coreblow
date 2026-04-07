/**
 * gateway/protocol/schema.ts
 * JSON-RPC protocol schema definitions for the gateway.
 */

export interface RPCRequest {
    jsonrpc: '2.0';
    method: string;
    params?: Record<string, unknown> | unknown[];
    id?: string | number;
}

export interface RPCResponse {
    jsonrpc: '2.0';
    result?: unknown;
    error?: RPCError;
    id?: string | number;
}

export interface RPCError {
    code: number;
    message: string;
    data?: unknown;
}

export const RPC_ERROR_CODES = {
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603,
    UNAUTHORIZED: -32001,
    FORBIDDEN: -32003,
} as const;

export function createRPCResponse(id: string | number | undefined, result: unknown): RPCResponse {
    return { jsonrpc: '2.0', result, id };
}

export function createRPCError(id: string | number | undefined, code: number, message: string): RPCResponse {
    return { jsonrpc: '2.0', error: { code, message }, id };
}

export function isValidRPCRequest(data: unknown): data is RPCRequest {
    if (typeof data !== 'object' || data === null) return false;
    const obj = data as Record<string, unknown>;
    return obj.jsonrpc === '2.0' && typeof obj.method === 'string';
}
