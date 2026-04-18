/** CoreBlow — Path Guards */
import path from "node:path";
export function isAbsolutePath(p: string): boolean { return path.isAbsolute(p); }
export function isRelativePath(p: string): boolean { return !path.isAbsolute(p); }
export function containsTraversal(p: string): boolean { return p.includes(".."); }
export function assertNoTraversal(p: string): void { if (containsTraversal(p)) throw new Error("Path traversal not allowed: " + p); }
