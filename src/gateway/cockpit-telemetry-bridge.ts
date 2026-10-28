import type { AcpWorkerTimeoutGuard } from "../acp/worker-timeout-guard.js";
import type { GatewayService, ServiceHealth } from "./service-registry.js";

export interface AcpSubagentNode {
  subagentId: string;
  parentAgentId: string;
  status: "idle" | "running" | "completed" | "failed" | "aborted";
  turnCount: number;
  tokensUsed: number;
  activeTool?: string;
  startedAt: number;
  updatedAt: number;
}

export interface CockpitScratchpadRef {
  contentHash: string;
  byteLength: number;
  preview: string;
}

export interface CockpitGraphSnapshot {
  timestamp: number;
  isLockdown: boolean;
  activeSubagents: AcpSubagentNode[];
  trustZonePosture: {
    zone0IngressActive: boolean;
    zone1WorkspaceActive: boolean;
    zone2OperatorActive: boolean;
  };
  recentScratchpadPointers: CockpitScratchpadRef[];
}

export interface CockpitBridgeOptions {
  workerGuard?: AcpWorkerTimeoutGuard;
  maxRecentScratchpadPointers?: number;
}

export class CockpitTelemetryBridge implements GatewayService {
  public readonly name = "cockpit-telemetry-bridge";
  private isRunning = false;
  private isLockdown = false;
  private readonly subagents = new Map<string, AcpSubagentNode>();
  private readonly recentScratchpads: CockpitScratchpadRef[] = [];
  private readonly maxRecentScratchpads: number;
  private readonly workerGuard?: AcpWorkerTimeoutGuard;
  private readonly listeners = new Set<(snapshot: CockpitGraphSnapshot) => void>();

  constructor(options: CockpitBridgeOptions = {}) {
    this.workerGuard = options.workerGuard;
    this.maxRecentScratchpads = options.maxRecentScratchpadPointers ?? 50;
  }

  public async start(): Promise<void> {
    this.isRunning = true;
    this.isLockdown = false;
  }

  public async stop(): Promise<void> {
    this.listeners.clear();
    this.subagents.clear();
    this.recentScratchpads.length = 0;
    this.isRunning = false;
  }

  public health(): ServiceHealth {
    if (!this.isRunning) {
      return { status: "down", detail: "Cockpit Telemetry Bridge is stopped." };
    }
    if (this.isLockdown) {
      return {
        status: "degraded",
        detail: "Gateway is currently in Emergency Lockdown mode.",
      };
    }
    return {
      status: "healthy",
      detail: `Tracking ${this.subagents.size} subagents across ${this.listeners.size} telemetry listeners.`,
    };
  }

  public registerSubagent(subagentId: string, parentAgentId: string): void {
    if (this.isLockdown) {
      throw new Error(`Cannot register subagent '${subagentId}': Gateway is in Emergency Lockdown.`);
    }
    const now = Date.now();
    this.subagents.set(subagentId, {
      subagentId,
      parentAgentId,
      status: "running",
      turnCount: 0,
      tokensUsed: 0,
      startedAt: now,
      updatedAt: now,
    });
    this.notifySubscribers();
  }

  public updateSubagentTurn(subagentId: string, tokens: number, activeTool?: string): void {
    const node = this.subagents.get(subagentId);
    if (!node) return;
    node.turnCount += 1;
    node.tokensUsed += tokens;
    node.activeTool = activeTool;
    node.updatedAt = Date.now();
    this.notifySubscribers();
  }

  public completeSubagent(subagentId: string, status: "completed" | "failed" = "completed"): void {
    const node = this.subagents.get(subagentId);
    if (!node) return;
    node.status = status;
    node.activeTool = undefined;
    node.updatedAt = Date.now();
    this.notifySubscribers();
  }

  public registerScratchpadPointer(pointer: CockpitScratchpadRef): void {
    this.recentScratchpads.unshift(pointer);
    if (this.recentScratchpads.length > this.maxRecentScratchpads) {
      this.recentScratchpads.pop();
    }
    this.notifySubscribers();
  }

  public triggerEmergencyKillSwitch(reason = "Operator emergency stop initiated"): {
    abortedCount: number;
    lockdown: boolean;
    timestamp: number;
  } {
    this.isLockdown = true;
    let abortedCount = 0;

    for (const node of this.subagents.values()) {
      if (node.status === "running") {
        node.status = "aborted";
        node.activeTool = undefined;
        node.updatedAt = Date.now();
        abortedCount += 1;

        if (this.workerGuard) {
          this.workerGuard.abortTask(node.subagentId, reason);
        }
      }
    }

    this.notifySubscribers();
    return {
      abortedCount,
      lockdown: true,
      timestamp: Date.now(),
    };
  }

  public resetLockdown(): void {
    this.isLockdown = false;
    this.notifySubscribers();
  }

  public getSnapshot(): CockpitGraphSnapshot {
    return {
      timestamp: Date.now(),
      isLockdown: this.isLockdown,
      activeSubagents: Array.from(this.subagents.values()),
      trustZonePosture: {
        zone0IngressActive: true,
        zone1WorkspaceActive: true,
        zone2OperatorActive: !this.isLockdown,
      },
      recentScratchpadPointers: [...this.recentScratchpads],
    };
  }

  public subscribe(listener: (snapshot: CockpitGraphSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifySubscribers(): void {
    if (this.listeners.size === 0) return;
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // Listener failure does not disrupt telemetry pipeline
      }
    }
  }
}
