/** CoreBlow — Sandbox FS Paths */ import path from "node:path"; export function resolveSandboxPath(root: string, relative: string): string { return path.join(root, relative); }
