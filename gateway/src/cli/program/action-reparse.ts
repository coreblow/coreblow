/** CoreBlow — Action Reparse */ export function reparseAction(args: string[]): string[] { return args.filter((a) => !a.startsWith("--")); }
