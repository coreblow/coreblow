/** CoreBlow — Log Level Option */ export function parseLogLevel(value: string): string { const valid = ["debug", "info", "warn", "error", "silent"]; return valid.includes(value) ? value : "info"; }
