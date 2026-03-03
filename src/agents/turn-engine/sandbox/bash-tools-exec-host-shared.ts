export function sanitizeCommand(cmd: string): string { return cmd.replace(/[;&|`$]/g, ""); }
export function isCommandAllowed(cmd: string, allowlist: string[] = []): boolean { const base = cmd.split(/\s+/)[0]; return allowlist.length === 0 || allowlist.includes(base); }
export function formatExecResult(stdout: string, stderr: string, exitCode: number): string { return exitCode === 0 ? stdout : `Error (${exitCode}): ${stderr}`; }
