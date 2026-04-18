/** CoreBlow — FS Bridge Path Safety */ export function isPathSafe(path: string, root: string): boolean { return !path.includes("..") && path.startsWith(root); }
