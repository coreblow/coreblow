import { randomUUID } from "node:crypto";
import type { DeliveryContext } from "../utils/delivery-context.types.js";
import type { TaskNotifyPolicy } from "./task-registry.types.js";
import type {
  JsonValue,
  TaskFlowRecord,
  TaskFlowStatus,
  TaskFlowSyncMode,
} from "./task-flow-registry.types.js";

const flows = new Map<string, TaskFlowRecord>();

export type TaskFlowUpdateResult =
  | { applied: true; flow: TaskFlowRecord }
  | { applied: false; reason: "not_found" | "not_managed" | "revision_conflict"; current?: TaskFlowRecord };

export function resetTaskFlowRegistryForTests(_options?: { persist?: boolean }): void {
  flows.clear();
}

export function createManagedTaskFlow(params: {
  ownerKey: string;
  controllerId: string;
  goal: string;
  requesterOrigin?: DeliveryContext;
  status?: TaskFlowStatus;
  notifyPolicy?: TaskNotifyPolicy;
  currentStep?: string | null;
  stateJson?: JsonValue | null;
  waitJson?: JsonValue | null;
  cancelRequestedAt?: number | null;
  createdAt?: number;
  updatedAt?: number;
  endedAt?: number | null;
}): TaskFlowRecord {
  const flowId = `flow_${randomUUID().replace(/-/g, "")}`;
  const now = Date.now();
  const record: TaskFlowRecord = {
    flowId,
    syncMode: "managed" as TaskFlowSyncMode,
    ownerKey: params.ownerKey,
    controllerId: params.controllerId,
    requesterOrigin: params.requesterOrigin,
    revision: 1,
    status: params.status ?? "queued",
    notifyPolicy: params.notifyPolicy ?? "done_only",
    goal: params.goal,
    currentStep: params.currentStep ?? undefined,
    stateJson: params.stateJson ?? undefined,
    waitJson: params.waitJson ?? undefined,
    cancelRequestedAt: params.cancelRequestedAt ?? undefined,
    createdAt: params.createdAt ?? now,
    updatedAt: params.updatedAt ?? now,
    endedAt: params.endedAt ?? undefined,
  };
  flows.set(flowId, record);
  return record;
}

export function getTaskFlowById(flowId: string): TaskFlowRecord | undefined {
  return flows.get(flowId);
}

export function listTaskFlowRecords(): TaskFlowRecord[] {
  return Array.from(flows.values());
}

export function listTaskFlowsForOwnerKey(ownerKey: string): TaskFlowRecord[] {
  return Array.from(flows.values()).filter((f) => f.ownerKey === ownerKey);
}

export function findLatestTaskFlowForOwnerKey(ownerKey: string): TaskFlowRecord | undefined {
  const list = listTaskFlowsForOwnerKey(ownerKey);
  return list[list.length - 1];
}

export function resolveTaskFlowForLookupToken(token: string): TaskFlowRecord | undefined {
  const byId = flows.get(token);
  if (byId) return byId;
  for (const f of flows.values()) {
    if (f.ownerKey === token || f.flowId === token) return f;
  }
  return undefined;
}

export function setFlowWaiting(params: {
  flowId: string;
  expectedRevision: number;
  currentStep?: string | null;
  stateJson?: JsonValue | null;
  waitJson?: JsonValue | null;
  blockedTaskId?: string | null;
  blockedSummary?: string | null;
  updatedAt?: number;
}): TaskFlowUpdateResult {
  const flow = flows.get(params.flowId);
  if (!flow) return { applied: false, reason: "not_found" };
  if (flow.syncMode !== "managed") return { applied: false, reason: "not_managed", current: flow };
  if (flow.revision !== params.expectedRevision) return { applied: false, reason: "revision_conflict", current: flow };

  flow.status = "waiting";
  flow.revision += 1;
  flow.updatedAt = params.updatedAt ?? Date.now();
  if (params.currentStep !== undefined) flow.currentStep = params.currentStep ?? undefined;
  if (params.stateJson !== undefined) flow.stateJson = params.stateJson ?? undefined;
  if (params.waitJson !== undefined) flow.waitJson = params.waitJson ?? undefined;
  if (params.blockedTaskId !== undefined) flow.blockedTaskId = params.blockedTaskId ?? undefined;
  if (params.blockedSummary !== undefined) flow.blockedSummary = params.blockedSummary ?? undefined;
  return { applied: true, flow };
}

export function resumeFlow(params: {
  flowId: string;
  expectedRevision: number;
  status?: "queued" | "running";
  currentStep?: string | null;
  stateJson?: JsonValue | null;
  updatedAt?: number;
}): TaskFlowUpdateResult {
  const flow = flows.get(params.flowId);
  if (!flow) return { applied: false, reason: "not_found" };
  if (flow.syncMode !== "managed") return { applied: false, reason: "not_managed", current: flow };
  if (flow.revision !== params.expectedRevision) return { applied: false, reason: "revision_conflict", current: flow };

  flow.status = params.status ?? "running";
  flow.revision += 1;
  flow.updatedAt = params.updatedAt ?? Date.now();
  if (params.currentStep !== undefined) flow.currentStep = params.currentStep ?? undefined;
  if (params.stateJson !== undefined) flow.stateJson = params.stateJson ?? undefined;
  return { applied: true, flow };
}

export function finishFlow(params: {
  flowId: string;
  expectedRevision: number;
  stateJson?: JsonValue | null;
  updatedAt?: number;
  endedAt?: number;
}): TaskFlowUpdateResult {
  const flow = flows.get(params.flowId);
  if (!flow) return { applied: false, reason: "not_found" };
  if (flow.syncMode !== "managed") return { applied: false, reason: "not_managed", current: flow };
  if (flow.revision !== params.expectedRevision) return { applied: false, reason: "revision_conflict", current: flow };

  flow.status = "succeeded";
  flow.revision += 1;
  flow.updatedAt = params.updatedAt ?? Date.now();
  flow.endedAt = params.endedAt ?? Date.now();
  if (params.stateJson !== undefined) flow.stateJson = params.stateJson ?? undefined;
  return { applied: true, flow };
}

export function failFlow(params: {
  flowId: string;
  expectedRevision: number;
  stateJson?: JsonValue | null;
  blockedTaskId?: string | null;
  blockedSummary?: string | null;
  updatedAt?: number;
  endedAt?: number;
}): TaskFlowUpdateResult {
  const flow = flows.get(params.flowId);
  if (!flow) return { applied: false, reason: "not_found" };
  if (flow.syncMode !== "managed") return { applied: false, reason: "not_managed", current: flow };
  if (flow.revision !== params.expectedRevision) return { applied: false, reason: "revision_conflict", current: flow };

  flow.status = "failed";
  flow.revision += 1;
  flow.updatedAt = params.updatedAt ?? Date.now();
  flow.endedAt = params.endedAt ?? Date.now();
  if (params.stateJson !== undefined) flow.stateJson = params.stateJson ?? undefined;
  if (params.blockedTaskId !== undefined) flow.blockedTaskId = params.blockedTaskId ?? undefined;
  if (params.blockedSummary !== undefined) flow.blockedSummary = params.blockedSummary ?? undefined;
  return { applied: true, flow };
}

export function requestFlowCancel(params: {
  flowId: string;
  expectedRevision: number;
  cancelRequestedAt?: number;
}): TaskFlowUpdateResult {
  const flow = flows.get(params.flowId);
  if (!flow) return { applied: false, reason: "not_found" };
  if (flow.syncMode !== "managed") return { applied: false, reason: "not_managed", current: flow };
  if (flow.revision !== params.expectedRevision) return { applied: false, reason: "revision_conflict", current: flow };

  flow.revision += 1;
  flow.cancelRequestedAt = params.cancelRequestedAt ?? Date.now();
  return { applied: true, flow };
}

export function createTaskFlowForTask(): TaskFlowRecord | undefined { return undefined; }
export function deleteTaskFlowRecordById(flowId: string): boolean { return flows.delete(flowId); }
export function syncFlowFromTask(): void {}
export function updateFlowRecordByIdExpectedRevision(): TaskFlowUpdateResult {
  return { applied: false, reason: "not_found" };
}

export type TaskFlowRegistryFacade = Record<string, unknown>;

export const taskFlowRegistry = Object.freeze({
  id: "src/tasks/task-flow-registry.ts",
});
