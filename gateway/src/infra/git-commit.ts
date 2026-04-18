/** CoreBlow — Git Commit Info */
import { execFileSync } from "node:child_process";
export interface GitCommitInfo { hash: string; shortHash: string; message: string; author: string; date: string; }
export function getLatestCommit(cwd?: string): GitCommitInfo | null {
  try { const raw = execFileSync("git", ["log", "-1", "--format=%H|%h|%s|%an|%aI"], { cwd, encoding: "utf8", timeout: 5000 }).trim();
  const [hash, shortHash, message, author, date] = raw.split("|"); return { hash, shortHash, message, author, date }; } catch { return null; }
}
