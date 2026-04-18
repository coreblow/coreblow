/** CoreBlow — Windows ARGV */ export function normalizeWindowsArgv(argv: string[]): string[] { return argv.map((a) => a.replace(/\\/g, "/")); }
