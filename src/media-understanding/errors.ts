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
  constructor(msg: string) { super(msg); this.name = 'MediaSizeExceededError'; }
}
export class MediaFormatError extends Error {
  constructor(msg: string) { super(msg); this.name = 'MediaFormatError'; }
}
