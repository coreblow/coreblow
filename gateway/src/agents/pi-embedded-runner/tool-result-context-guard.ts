/** CoreBlow — PI Tool Result Context Guard */ export function shouldIncludeToolResult(charCount: number, maxChars = 50000): boolean { return charCount <= maxChars; }
