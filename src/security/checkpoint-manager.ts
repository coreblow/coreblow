/**
 * CoreBlow Security: Checkpoint Manager
 *
 * Provides automatic, lightweight pre-mutation snapshots for files modified by
 * autonomous tools (`write_file`, `patch`, `multi_patch`), with 1-click `/rollback`
 * and `/undo` support.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";

export interface FileCheckpoint {
  id: string;
  sessionId?: string;
  filePath: string;
  toolName: string;
  createdAt: number;
  existed: boolean;
  contentHash?: string;
  backupFileName?: string;
}

export interface RollbackResult {
  success: boolean;
  message: string;
  rolledBack: FileCheckpoint | null;
}

export class CheckpointManager {
  private baseDir: string;
  private maxCheckpoints: number;

  constructor(customDir?: string, maxCheckpoints = 50) {
    const rootDir = process.env.COREBLOW_STATE_DIR || path.join(os.homedir(), ".coreblow");
    this.baseDir = customDir ?? path.join(rootDir, "checkpoints");
    this.maxCheckpoints = maxCheckpoints;
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.baseDir)) {
      try {
        fs.mkdirSync(this.baseDir, { recursive: true });
      } catch {
        // Ignored if created concurrently
      }
    }
  }

  private getIndexPath(): string {
    return path.join(this.baseDir, "index.json");
  }

  private loadIndex(): FileCheckpoint[] {
    const indexPath = this.getIndexPath();
    if (!fs.existsSync(indexPath)) {
      return [];
    }
    try {
      const raw = fs.readFileSync(indexPath, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private saveIndex(checkpoints: FileCheckpoint[]): void {
    this.ensureDirectory();
    const indexPath = this.getIndexPath();
    const tmpPath = `${indexPath}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpPath, JSON.stringify(checkpoints, null, 2), "utf8");
    fs.renameSync(tmpPath, indexPath);
  }

  /**
   * Captures a snapshot of the target file before any destructive mutation.
   */
  createCheckpoint(targetPath: string, toolName: string, sessionId?: string): FileCheckpoint {
    this.ensureDirectory();
    const resolvedPath = path.resolve(targetPath);
    const id = `cp_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const createdAt = Date.now();

    const fileExists = fs.existsSync(resolvedPath);
    let contentHash: string | undefined;
    let backupFileName: string | undefined;

    if (fileExists) {
      try {
        const content = fs.readFileSync(resolvedPath);
        contentHash = crypto.createHash("sha256").update(content).digest("hex");
        backupFileName = `${id}.bak`;
        fs.writeFileSync(path.join(this.baseDir, backupFileName), content);
      } catch {
        // Fallback: file unreadable, mark non-existent
      }
    }

    const checkpoint: FileCheckpoint = {
      id,
      sessionId,
      filePath: resolvedPath,
      toolName,
      createdAt,
      existed: Boolean(fileExists && backupFileName),
      contentHash,
      backupFileName,
    };

    const index = this.loadIndex();
    index.unshift(checkpoint);

    // Auto-prune to maximum checkpoints
    this.pruneCheckpoints(index);
    return checkpoint;
  }

  /**
   * Returns list of stored checkpoints, optionally filtered by session ID.
   */
  listCheckpoints(sessionId?: string): FileCheckpoint[] {
    const list = this.loadIndex();
    if (!sessionId) {
      return list;
    }
    return list.filter((cp) => cp.sessionId === sessionId);
  }

  /**
   * Rolls back a specific checkpoint or the most recent one for the session.
   */
  rollbackCheckpoint(checkpointId?: string, sessionId?: string): RollbackResult {
    const index = this.loadIndex();
    if (index.length === 0) {
      return {
        success: false,
        message: "No checkpoints available to rollback.",
        rolledBack: null,
      };
    }

    let targetIndex = -1;
    if (checkpointId) {
      targetIndex = index.findIndex((cp) => cp.id === checkpointId);
    } else if (sessionId) {
      targetIndex = index.findIndex((cp) => cp.sessionId === sessionId);
    } else {
      targetIndex = 0; // Most recent overall
    }

    if (targetIndex === -1) {
      return {
        success: false,
        message: checkpointId
          ? `Checkpoint '${checkpointId}' not found.`
          : `No checkpoints found for session '${sessionId}'.`,
        rolledBack: null,
      };
    }

    const cp = index[targetIndex];

    try {
      if (cp.existed && cp.backupFileName) {
        const backupFile = path.join(this.baseDir, cp.backupFileName);
        if (!fs.existsSync(backupFile)) {
          return {
            success: false,
            message: `Backup data for checkpoint '${cp.id}' is missing from disk.`,
            rolledBack: cp,
          };
        }
        const parentDir = path.dirname(cp.filePath);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        const originalContent = fs.readFileSync(backupFile);
        fs.writeFileSync(cp.filePath, originalContent);

        // Remove from index
        index.splice(targetIndex, 1);
        this.saveIndex(index);

        return {
          success: true,
          message: `Successfully rolled back '${path.basename(cp.filePath)}' to snapshot ${cp.id} (tool: ${cp.toolName}).`,
          rolledBack: cp,
        };
      } else {
        // File did not exist prior to this tool call - remove the newly created file
        if (fs.existsSync(cp.filePath)) {
          fs.unlinkSync(cp.filePath);
        }

        index.splice(targetIndex, 1);
        this.saveIndex(index);

        return {
          success: true,
          message: `Successfully rolled back '${path.basename(cp.filePath)}' by removing newly created file (snapshot ${cp.id}).`,
          rolledBack: cp,
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Failed to rollback checkpoint '${cp.id}': ${msg}`,
        rolledBack: cp,
      };
    }
  }

  /**
   * Prunes oldest checkpoints beyond maxCheckpoints threshold and removes backup files.
   */
  private pruneCheckpoints(index: FileCheckpoint[]): void {
    if (index.length <= this.maxCheckpoints) {
      this.saveIndex(index);
      return;
    }

    const retained = index.slice(0, this.maxCheckpoints);
    const pruned = index.slice(this.maxCheckpoints);

    for (const cp of pruned) {
      if (cp.backupFileName) {
        const backupPath = path.join(this.baseDir, cp.backupFileName);
        try {
          if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
          }
        } catch {
          // Ignore removal errors
        }
      }
    }

    this.saveIndex(retained);
  }
}

let globalCheckpointManager: CheckpointManager | null = null;

export function getCheckpointManager(customDir?: string): CheckpointManager {
  if (!globalCheckpointManager || customDir) {
    const inst = new CheckpointManager(customDir);
    if (!customDir) {
      globalCheckpointManager = inst;
    }
    return inst;
  }
  return globalCheckpointManager;
}
