/** CoreBlow — Node Shell */ export function resolveNodeShell(): string { return process.platform === "win32" ? "cmd.exe" : "/bin/sh"; }
