/** CoreBlow — Session Artifacts */
import path from "node:path";
export interface SessionArtifact { name: string; type: string; path: string; size: number; createdAt: number; }
export function resolveArtifactPath(sessionDir: string, name: string): string { return path.join(sessionDir, "artifacts", name); }
