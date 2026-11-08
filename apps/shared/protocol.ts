/**
 * CoreBlow — Shared Cross-Platform RPC Protocol & Gateway Endpoints
 *
 * Defines canonical HTTP REST & WebSocket JSON-RPC endpoints on Port 18789.
 */

import type {
  DesktopStudioSnapshot,
  DesktopWorktreeDiffView,
  PrApprovalPayload,
  PrRollbackPayload,
  WarRoomSummary,
} from "./types.js";

export const GATEWAY_MICROKERNEL_PORT = 18789;
export const DEFAULT_LOCAL_GATEWAY_URL = `http://127.0.0.1:${GATEWAY_MICROKERNEL_PORT}`;

export const GatewayRpcEndpoints = {
  // Desktop Studio & Mobile Snapshot
  DESKTOP_STATE: "/api/corehub/desktop/state",
  DESKTOP_STATE_ALIAS: "/desktop/state",

  // Quick Launch & Decision Routing
  QUICK_LAUNCH: "/api/corehub/desktop/quick-launch",
  QUICK_LAUNCH_ALIAS: "/quick-launch",

  // Working Tree Diff & 5-Gate Scorecard
  DIFF_INSPECTOR: "/api/corehub/desktop/diff-inspector",
  DIFF_INSPECTOR_ALIAS: "/diff-inspector",

  // Remote PR Governance Actions
  PR_APPROVE: "/api/corehub/desktop/pr-approve",
  PR_ROLLBACK: "/api/corehub/desktop/pr-rollback",

  // War Room DAG Orchestration
  WAR_ROOM_STATE: "/api/corehub/desktop/war-room",

  // Health Probe
  HEALTH: "/health",
  STATUS: "/status",
} as const;

export interface AppMessage {
  readonly type: string;
  readonly payload: unknown;
  readonly timestamp: number;
}

export function createMessage(type: string, payload: unknown): AppMessage {
  return { type, payload, timestamp: Date.now() };
}

export interface QuickLaunchRequest {
  readonly prompt: string;
  readonly workingDirectory?: string;
  readonly branch?: string;
  readonly model?: string;
}

export interface QuickLaunchResponse {
  readonly ok: boolean;
  readonly routeTier: string;
  readonly reply?: string;
  readonly latencyMs?: number;
}

export interface DiffInspectorRequest {
  readonly diffText?: string;
  readonly branchName?: string;
  readonly prId?: string;
  readonly changedFiles?: readonly string[];
}

export type DiffInspectorResponse = DesktopWorktreeDiffView;
