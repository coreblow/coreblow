const MAX_SAFE_INTEGER_ABS_STR = String(Number.MAX_SAFE_INTEGER);

function isAsciiDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= "0" && ch <= "9";
}

function isUnsafeIntegerLiteral(token: string): boolean {
  const digits = token[0] === "-" ? token.slice(1) : token;
  if (digits.length < MAX_SAFE_INTEGER_ABS_STR.length) {
    return false;
  }
  return digits.length > MAX_SAFE_INTEGER_ABS_STR.length || digits > MAX_SAFE_INTEGER_ABS_STR;
}

function quoteUnsafeIntegerLiterals(input: string): string {
  let output = "";
  let inString = false;
  let escaped = false;
  for (let idx = 0; idx < input.length;) {
    const ch = input[idx] ?? "";
    if (inString) {
      output += ch;
      escaped = escaped ? false : ch === "\\";
      if (!escaped && ch === "\"") {
        inString = false;
      }
      idx += 1;
      continue;
    }
    if (ch === "\"") {
      inString = true;
      output += ch;
      idx += 1;
      continue;
    }
    if (ch === "-" || isAsciiDigit(ch)) {
      const match = input.slice(idx).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
      if (match) {
        const token = match[0];
        const isInteger = !/[.eE]/.test(token);
        output += isInteger && isUnsafeIntegerLiteral(token) ? `"${token}"` : token;
        idx += token.length;
        continue;
      }
    }
    output += ch;
    idx += 1;
  }
  return output;
}

export function parseJsonPreservingUnsafeIntegers(input: string): unknown {
  return JSON.parse(quoteUnsafeIntegerLiterals(input)) as unknown;
}

export function parseJsonObjectPreservingUnsafeIntegers(
  value: unknown,
): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      const parsed = parseJsonPreservingUnsafeIntegers(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
