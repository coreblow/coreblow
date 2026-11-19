/**
 * CoreBlow Security: Global Emergency Stop (E-Stop)
 *
 * Provides atomic, instantaneous pausing and resumption of autonomous agent
 * execution across the Gateway, ReAct Engine, and desktop control surfaces.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export interface EmergencyStopState {
  paused: boolean;
  reason?: string;
  pausedAt?: number;
  resumedAt?: number;
}

export class EmergencyStopController {
  private filePath: string;

  constructor(customPath?: string) {
    const rootDir = process.env.COREBLOW_STATE_DIR || path.join(os.homedir(), ".coreblow");
    this.filePath = customPath ?? path.join(rootDir, "estop.json");
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {
        // Concurrency safe
      }
    }
  }

  getState(): EmergencyStopState {
    if (!fs.existsSync(this.filePath)) {
      return { paused: false };
    }
    try {
      const raw = fs.readFileSync(this.filePath, "utf8");
      const data = JSON.parse(raw);
      return {
        paused: Boolean(data?.paused),
        reason: typeof data?.reason === "string" ? data.reason : undefined,
        pausedAt: typeof data?.pausedAt === "number" ? data.pausedAt : undefined,
        resumedAt: typeof data?.resumedAt === "number" ? data.resumedAt : undefined,
      };
    } catch {
      return { paused: false };
    }
  }

  isPaused(): boolean {
    return this.getState().paused;
  }

  pause(reason = "Emergency Stop triggered by user/operator"): EmergencyStopState {
    this.ensureDirectory();
    const nextState: EmergencyStopState = {
      paused: true,
      reason,
      pausedAt: Date.now(),
      resumedAt: undefined,
    };
    this.persistState(nextState);
    return nextState;
  }

  resume(): EmergencyStopState {
    this.ensureDirectory();
    const prev = this.getState();
    const nextState: EmergencyStopState = {
      paused: false,
      reason: undefined,
      pausedAt: prev.pausedAt,
      resumedAt: Date.now(),
    };
    this.persistState(nextState);
    return nextState;
  }

  private persistState(state: EmergencyStopState): void {
    const tmp = `${this.filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
    fs.renameSync(tmp, this.filePath);
  }
}

let globalEmergencyStopController: EmergencyStopController | null = null;

export function getEmergencyStopController(customPath?: string): EmergencyStopController {
  if (!globalEmergencyStopController || customPath) {
    const inst = new EmergencyStopController(customPath);
    if (!customPath) {
      globalEmergencyStopController = inst;
    }
    return inst;
  }
  return globalEmergencyStopController;
}
