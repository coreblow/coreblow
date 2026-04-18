/** CoreBlow — JSON UTF8 Bytes */ export function jsonUtf8ByteLength(value: unknown): number { return Buffer.byteLength(JSON.stringify(value), "utf8"); }
