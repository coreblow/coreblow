import {
  asOptionalBoolean,
  asOptionalString,
  asTrimmedString,
  type AcpErrorEvent,
  isRecord,
} from "./shared.js";

export function parseControlJsonError(value: unknown): AcpErrorEvent | null {
  if (!isRecord(value)) {
    return null;
  }
  const error = isRecord(value.error) ? value.error : null;
  if (!error) {
    return null;
  }
  const message = asTrimmedString(error.message) || "acp reported an error";
  const codeValue = error.code;
  return {
    message,
    code:
      typeof codeValue === "number" && Number.isFinite(codeValue)
        ? String(codeValue)
        : asOptionalString(codeValue),
    retryable: asOptionalBoolean(error.retryable),
  };
}
