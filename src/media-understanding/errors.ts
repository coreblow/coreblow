export type MediaUnderstandingSkipReason =
  | "maxBytes"
  | "timeout"
  | "unsupported"
  | "empty"
  | "tooSmall";

export class MediaUnderstandingSkipError extends Error {
  readonly reason: MediaUnderstandingSkipReason;

  constructor(reason: MediaUnderstandingSkipReason, message: string) {
    super(message);
    this.reason = reason;
    this.name = "MediaUnderstandingSkipError";
  }
}

export function isMediaUnderstandingSkipError(err: unknown): err is MediaUnderstandingSkipError {
  return err instanceof MediaUnderstandingSkipError;
}


// Stub error classes — referenced by audio.ts, image-analysis.ts etc.
export class MediaSizeExceededError extends Error {
  constructor(mediaTypeOrMessage: string, actualBytes?: number, maxBytes?: number) {
    const msg = actualBytes && maxBytes
      ? `${mediaTypeOrMessage} size (${actualBytes} bytes) exceeds maximum allowed (${maxBytes} bytes)`
      : mediaTypeOrMessage;
    super(msg);
    this.name = 'MediaSizeExceededError';
  }
}
export class MediaFormatError extends Error {
  constructor(mediaTypeOrMessage: string, format?: string) {
    const msg = format ? `Unsupported ${mediaTypeOrMessage} format: ${format}` : mediaTypeOrMessage;
    super(msg);
    this.name = 'MediaFormatError';
  }
}
