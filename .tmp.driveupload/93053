/**
 * CoreBlow — API Playground
 *
 * Interactive API testing environment that builds
 * request forms from API definitions, tracks history,
 * and provides response formatting.
 */

/** Playground request */
export interface PlaygroundRequest {
    id: string;
    endpoint: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
    timestamp: number;
}

/** Playground response */
export interface PlaygroundResponse {
    requestId: string;
    status: number;
    headers: Record<string, string>;
    body: unknown;
    durationMs: number;
    size: number;
}

/** Request-response pair */
export interface PlaygroundEntry {
    request: PlaygroundRequest;
    response?: PlaygroundResponse;
}

/**
 * CoreBlow API Playground
 */
export class ApiPlayground {
    private history: PlaygroundEntry[] = [];
    private maxHistory = 100;
    private idCounter = 0;
    private savedRequests = new Map<string, PlaygroundRequest>();

    /**
     * Create a request.
     */
    createRequest(endpoint: string, method: string, headers?: Record<string, string>, body?: string): PlaygroundRequest {
        return {
            id: `req-${++this.idCounter}`, endpoint, method,
            headers: { 'Content-Type': 'application/json', ...headers },
            body, timestamp: Date.now(),
        };
    }

    /**
     * Record a response for a request.
     */
    recordResponse(request: PlaygroundRequest, status: number, body: unknown, durationMs: number, headers?: Record<string, string>): PlaygroundEntry {
        const response: PlaygroundResponse = {
            requestId: request.id, status,
            headers: headers ?? {}, body,
            durationMs, size: JSON.stringify(body).length,
        };
        const entry: PlaygroundEntry = { request, response };
        this.history.push(entry);
        if (this.history.length > this.maxHistory) this.history = this.history.slice(-this.maxHistory);
        return entry;
    }

    /**
     * Save a request for reuse.
     */
    saveRequest(name: string, request: PlaygroundRequest): void {
        this.savedRequests.set(name, request);
    }

    /**
     * Load a saved request.
     */
    loadRequest(name: string): PlaygroundRequest | null {
        return this.savedRequests.get(name) ?? null;
    }

    /**
     * Format response for display.
     */
    formatResponse(response: PlaygroundResponse): string {
        const lines: string[] = [
            `HTTP ${response.status}`,
            `Duration: ${response.durationMs}ms`,
            `Size: ${response.size} bytes`,
            ``,
            typeof response.body === 'string' ? response.body : JSON.stringify(response.body, null, 2),
        ];
        return lines.join('\n');
    }

    /**
     * Get history.
     */
    getHistory(limit?: number): PlaygroundEntry[] {
        return this.history.slice(-(limit ?? 20));
    }

    /**
     * List saved requests.
     */
    listSaved(): string[] {
        return Array.from(this.savedRequests.keys());
    }

    /**
     * Clear history.
     */
    clearHistory(): void { this.history = []; }

    /** Count history */
    count(): number { return this.history.length; }
}
