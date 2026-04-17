/**
 * CoreBlow Resilience — Error Boundary
 *
 * Global error handling layer that catches, classifies, and handles
 * unhandled errors, promise rejections, and runtime exceptions.
 * Provides structured error responses and automatic recovery.
 */

/** Error classification */
export type ErrorClass =
    | 'validation'
    | 'auth'
    | 'rate-limit'
    | 'timeout'
    | 'upstream'
    | 'internal'
    | 'not-found'
    | 'conflict';

/** Structured error */
export interface StructuredError {
    class: ErrorClass;
    code: string;
    message: string;
    statusCode: number;
    retryable: boolean;
    details?: Record<string, unknown>;
    originalError?: Error;
}

/** Error handler function */
export type ErrorHandler = (err: StructuredError) => void;

/**
 * CoreBlow Error Boundary
 */
export class ErrorBoundary {
    private handlers = new Map<ErrorClass, ErrorHandler>();
    private fallbackHandler: ErrorHandler | null = null;
    private errorLog: Array<{ error: StructuredError; timestamp: number }> = [];
    private maxLog = 200;
    private installed = false;

    /**
     * Register a handler for a specific error class.
     */
    on(errorClass: ErrorClass, handler: ErrorHandler): void {
        this.handlers.set(errorClass, handler);
    }

    /**
     * Set a fallback handler for unclassified errors.
     */
    onFallback(handler: ErrorHandler): void {
        this.fallbackHandler = handler;
    }

    /**
     * Install global error handlers (uncaughtException, unhandledRejection).
     */
    install(): void {
        if (this.installed) return;

        process.on('uncaughtException', (err) => {
            this.handle(this.classify(err));
        });

        process.on('unhandledRejection', (reason) => {
            const err = reason instanceof Error ? reason : new Error(String(reason));
            this.handle(this.classify(err));
        });

        this.installed = true;
    }

    /**
     * Classify an error.
     */
    classify(err: Error): StructuredError {
        const message = err.message.toLowerCase();

        // Timeout
        if (message.includes('timeout') || message.includes('timed out') || err.name === 'AbortError') {
            return { class: 'timeout', code: 'TIMEOUT', message: err.message, statusCode: 504, retryable: true, originalError: err };
        }

        // Auth
        if (message.includes('unauthorized') || message.includes('forbidden') || message.includes('auth')) {
            return { class: 'auth', code: 'AUTH_ERROR', message: err.message, statusCode: 401, retryable: false, originalError: err };
        }

        // Rate limit
        if (message.includes('rate limit') || message.includes('too many')) {
            return { class: 'rate-limit', code: 'RATE_LIMITED', message: err.message, statusCode: 429, retryable: true, originalError: err };
        }

        // Validation
        if (message.includes('invalid') || message.includes('validation') || message.includes('required')) {
            return { class: 'validation', code: 'VALIDATION_ERROR', message: err.message, statusCode: 400, retryable: false, originalError: err };
        }

        // Not found
        if (message.includes('not found') || message.includes('404')) {
            return { class: 'not-found', code: 'NOT_FOUND', message: err.message, statusCode: 404, retryable: false, originalError: err };
        }

        // Upstream (network/API errors)
        if (message.includes('econnrefused') || message.includes('fetch') || message.includes('network') || message.includes('502')) {
            return { class: 'upstream', code: 'UPSTREAM_ERROR', message: err.message, statusCode: 502, retryable: true, originalError: err };
        }

        // Default: internal
        return { class: 'internal', code: 'INTERNAL_ERROR', message: err.message, statusCode: 500, retryable: false, originalError: err };
    }

    /**
     * Handle a structured error.
     */
    handle(err: StructuredError): void {
        this.errorLog.push({ error: err, timestamp: Date.now() });
        if (this.errorLog.length > this.maxLog) {
            this.errorLog = this.errorLog.slice(-this.maxLog);
        }

        const handler = this.handlers.get(err.class) ?? this.fallbackHandler;
        if (handler) {
            try { handler(err); } catch { /* handler failed */ }
        }
    }

    /**
     * Wrap an async function with error boundary.
     */
    async wrap<T>(fn: () => Promise<T>): Promise<T> {
        try {
            return await fn();
        } catch (err) {
            const structured = this.classify(err instanceof Error ? err : new Error(String(err)));
            this.handle(structured);
            throw structured;
        }
    }

    /**
     * Get recent errors.
     */
    getRecentErrors(limit?: number): Array<{ error: StructuredError; timestamp: number }> {
        return this.errorLog.slice(-(limit ?? 20));
    }

    /**
     * Get error counts by class.
     */
    getErrorCounts(): Record<ErrorClass, number> {
        const counts: Partial<Record<ErrorClass, number>> = {};
        for (const entry of this.errorLog) {
            counts[entry.error.class] = (counts[entry.error.class] ?? 0) + 1;
        }
        return counts as Record<ErrorClass, number>;
    }

    /**
     * Build an HTTP-friendly error response.
     */
    toHttpResponse(err: StructuredError): { statusCode: number; body: Record<string, unknown> } {
        return {
            statusCode: err.statusCode,
            body: {
                error: {
                    code: err.code,
                    message: err.message,
                    retryable: err.retryable,
                    details: err.details,
                },
            },
        };
    }
}
