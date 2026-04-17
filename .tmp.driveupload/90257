/**
 * media-understanding/errors.ts
 * Typed errors for media processing.
 */

export class MediaProcessingError extends Error {
    readonly code: string;
    readonly mediaType: string;
    readonly recoverable: boolean;

    constructor(params: { code: string; mediaType: string; message: string; recoverable?: boolean; cause?: Error }) {
        super(params.message, { cause: params.cause });
        this.name = 'MediaProcessingError';
        this.code = params.code;
        this.mediaType = params.mediaType;
        this.recoverable = params.recoverable ?? false;
    }
}

export class MediaSizeExceededError extends MediaProcessingError {
    readonly actualSize: number;
    readonly maxSize: number;
    constructor(type: string, actualSize: number, maxSize: number) {
        super({ code: 'SIZE_EXCEEDED', mediaType: type, message: `${type} size ${actualSize} exceeds limit ${maxSize}`, recoverable: false });
        this.actualSize = actualSize; this.maxSize = maxSize;
    }
}

export class MediaFormatError extends MediaProcessingError {
    readonly format: string;
    constructor(type: string, format: string) {
        super({ code: 'UNSUPPORTED_FORMAT', mediaType: type, message: `Unsupported ${type} format: ${format}`, recoverable: false });
        this.format = format;
    }
}

export class MediaProviderError extends MediaProcessingError {
    readonly provider: string;
    readonly statusCode?: number;
    constructor(params: { type: string; provider: string; message: string; statusCode?: number; cause?: Error }) {
        super({ code: 'PROVIDER_ERROR', mediaType: params.type, message: params.message, recoverable: true, cause: params.cause });
        this.provider = params.provider; this.statusCode = params.statusCode;
    }
}

export class MediaTimeoutError extends MediaProcessingError {
    readonly timeoutMs: number;
    constructor(type: string, timeoutMs: number) {
        super({ code: 'TIMEOUT', mediaType: type, message: `${type} processing timed out after ${timeoutMs}ms`, recoverable: true });
        this.timeoutMs = timeoutMs;
    }
}
