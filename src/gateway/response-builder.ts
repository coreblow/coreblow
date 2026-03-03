/**
 * CoreBlow — Response Builder
 *
 * Fluent API for building HTTP-like responses with
 * status codes, headers, body, and serialization.
 */

/** Response */
export interface BuiltResponse {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: unknown;
    serialized: string;
}

/**
 * CoreBlow Response Builder
 */
export class ResponseBuilder {
    private _status = 200;
    private _headers: Record<string, string> = { 'Content-Type': 'application/json' };
    private _body: unknown = null;

    /**
     * Set status code.
     */
    status(code: number): this { this._status = code; return this; }

    /**
     * Set header.
     */
    header(key: string, value: string): this { this._headers[key] = value; return this; }

    /**
     * Set JSON body.
     */
    json(data: unknown): this { this._body = data; this._headers['Content-Type'] = 'application/json'; return this; }

    /**
     * Set text body.
     */
    text(data: string): this { this._body = data; this._headers['Content-Type'] = 'text/plain'; return this; }

    /**
     * Set HTML body.
     */
    html(data: string): this { this._body = data; this._headers['Content-Type'] = 'text/html'; return this; }

    /**
     * Build the response.
     */
    build(): BuiltResponse {
        const statusTexts: Record<number, string> = {
            200: 'OK', 201: 'Created', 204: 'No Content',
            400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
            500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable',
        };
        const serialized = typeof this._body === 'string' ? this._body : JSON.stringify(this._body);
        return {
            status: this._status,
            statusText: statusTexts[this._status] ?? 'Unknown',
            headers: { ...this._headers },
            body: this._body,
            serialized,
        };
    }

    // === Static factory methods ===
    static ok(data: unknown): BuiltResponse { return new ResponseBuilder().status(200).json(data).build(); }
    static created(data: unknown): BuiltResponse { return new ResponseBuilder().status(201).json(data).build(); }
    static notFound(message?: string): BuiltResponse { return new ResponseBuilder().status(404).json({ error: message ?? 'Not Found' }).build(); }
    static error(message?: string, code?: number): BuiltResponse { return new ResponseBuilder().status(code ?? 500).json({ error: message ?? 'Internal Server Error' }).build(); }
}
