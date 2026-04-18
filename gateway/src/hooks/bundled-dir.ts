/** CoreBlow — Hooks Bundled Dir */ import path from "node:path"; export function resolveBundledHooksDir(): string { return path.join(process.cwd(), "hooks"); }
