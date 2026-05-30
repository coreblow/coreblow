import { CommandLane } from "../process/lanes.js";

export const AGENT_LANE_NESTED = CommandLane.Nested;
export const AGENT_LANE_CRON_NESTED = CommandLane.CronNested;
export const AGENT_LANE_SUBAGENT = CommandLane.Subagent;
const NESTED_LANE = "nested";
const NESTED_LANE_PREFIX = `${NESTED_LANE}:`;

export function resolveNestedAgentLane(lane?: string): string {
  const trimmed = lane?.trim();
  // Nested agent runs should not inherit the cron execution lane. Cron jobs
  // already occupy that lane while they dispatch inner work.
  if (!trimmed || trimmed === "cron") {
    return AGENT_LANE_NESTED;
  }
  return trimmed;
}

export function resolveCronAgentLane(lane?: string): string {
  const trimmed = lane?.trim();
  if (!trimmed || trimmed === CommandLane.Cron) {
    return AGENT_LANE_CRON_NESTED;
  }
  return trimmed;
}

export function resolveNestedAgentLaneForSession(sessionKey: string | undefined): string {
  const trimmed = sessionKey?.trim();
  if (!trimmed) {
    return AGENT_LANE_NESTED;
  }
  return `${NESTED_LANE_PREFIX}${trimmed}`;
}

export function isNestedAgentLane(lane: string | undefined): boolean {
  return Boolean(lane && (lane === NESTED_LANE || lane.startsWith(NESTED_LANE_PREFIX)));
}

// Stub class — used by agent-engine.ts OOP facade
export class LaneManager {
  private activeLanes = new Map<string, { id: string }>();
  private maxLanes: number;
  constructor(maxLanes: number) { this.maxLanes = maxLanes; }
  acquire(sessionId: string): { id: string } | null { if (this.activeLanes.size >= this.maxLanes) return null; const lane = { id: sessionId }; this.activeLanes.set(sessionId, lane); return lane; }
  release(laneId: string): void { this.activeLanes.delete(laneId); }
}
