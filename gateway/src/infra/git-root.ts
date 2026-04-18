/** CoreBlow — Git Root Detection */
import { execFileSync } from "node:child_process";
export function findGitRoot(cwd?: string): string | null { try { return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", timeout: 5000 }).trim() || null; } catch { return null; } }
export function isGitRepo(cwd?: string): boolean { return findGitRoot(cwd) !== null; }
