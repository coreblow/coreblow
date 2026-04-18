/** CoreBlow — Node Invoke Sanitize */ export function sanitizeInvokeArgs(args: string[]): string[] { return args.map((a) => a.replace(/[;&|`$]/g, "")); }
