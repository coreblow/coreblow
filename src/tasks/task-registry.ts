import { randomUUID } from "node:crypto";
import type { CoreBlowConfig } from "../config/types.coreblow.js";
import type {
  DetachedTaskCancelResult,
  DetachedTaskCreateParams,
} from "./detached-task-runtime-contract.js";
import type {
  TaskDeliveryState,
  TaskDeliveryStatus,
  TaskNotifyPolicy,
  TaskRecord,
  TaskStatus,
} from "./task-registry.types.js";

const tasks = new Map<string, TaskRecord>();
const deliveryStates = new Map<string, TaskDeliveryState>();

export type TaskRegistryDeliveryRuntime = {
  sendMessage?: (params: unknown) => Promise<unknown> | unknown;
};

export type TaskRegistryControlRuntime = {
  getAcpSessionManager?: () => {
    cancelSession: (params: { cfg: unknown; sessionKey: string; reason?: string }) => Promise<unknown> | unknown;
  };
  killSubagentRunAdmin?: (params: unknown) => unknown;
};

let deliveryRuntime: TaskRegistryDeliveryRuntime | undefined;
let controlRuntime: TaskRegistryControlRuntime | undefined;

export function setTaskRegistryDeliveryRuntimeForTests(rt: TaskRegistryDeliveryRuntime): void {
  deliveryRuntime = rt;
}

export function resetTaskRegistryDeliveryRuntimeForTests(): void {
  deliveryRuntime = undefined;
}

export function setTaskRegistryControlRuntimeForTests(rt: TaskRegistryControlRuntime): void {
  controlRuntime = rt;
}

export function resetTaskRegistryControlRuntimeForTests(): void {
  controlRuntime = undefined;
}

export function resetTaskRegistryForTests(_options?: { persist?: boolean }): void {
  tasks.clear();
  deliveryStates.clear();
  deliveryRuntime = undefined;
  controlRuntime = undefined;
}

export function createTaskRecord(
  params: DetachedTaskCreateParams & { status?: TaskStatus; startedAt?: number; lastEventAt?: number; progressSummary?: string | null },
): TaskRecord {
  const taskId = `task_${randomUUID().replace(/-/g, "")}`;
  const now = Date.now();
  const record: TaskRecord = {
    taskId,
    runtime: params.runtime,
    taskKind: params.taskKind,
    sourceId: params.sourceId,
    requesterSessionKey: params.requesterSessionKey ?? params.ownerKey ?? "unknown",
    ownerKey: params.ownerKey ?? params.requesterSessionKey ?? "unknown",
    scopeKind: params.scopeKind ?? "session",
    childSessionKey: params.childSessionKey,
    parentFlowId: params.parentFlowId,
    parentTaskId: params.parentTaskId,
    agentId: params.agentId,
    runId: params.runId,
    label: params.label,
    task: params.task,
    status: params.status ?? "queued",
    deliveryStatus: params.deliveryStatus ?? "pending",
    notifyPolicy: params.notifyPolicy ?? "done_only",
    createdAt: now,
    startedAt: params.startedAt,
    lastEventAt: params.lastEventAt ?? now,
    progressSummary: params.progressSummary ?? undefined,
  };
  tasks.set(taskId, record);
  return record;
}

export function getTaskById(taskId: string): TaskRecord | undefined {
  return tasks.get(taskId);
}

export function findTaskByRunId(runId: string): TaskRecord | undefined {
  for (const task of tasks.values()) {
    if (task.runId === runId) {
      return task;
    }
  }
  return undefined;
}

export function listTaskRecords(): TaskRecord[] {
  return Array.from(tasks.values());
}

export function listTasksForFlowId(flowId: string): TaskRecord[] {
  return Array.from(tasks.values()).filter((t) => t.parentFlowId === flowId);
}

export function listTasksForOwnerKey(ownerKey: string): TaskRecord[] {
  return Array.from(tasks.values()).filter((t) => t.ownerKey === ownerKey);
}

export function listTasksForRelatedSessionKey(relatedSessionKey: string): TaskRecord[] {
  return Array.from(tasks.values()).filter(
    (t) =>
      t.requesterSessionKey === relatedSessionKey ||
      t.ownerKey === relatedSessionKey ||
      t.childSessionKey === relatedSessionKey,
  );
}

export function resolveTaskForLookupToken(token: string): TaskRecord | undefined {
  const byId = tasks.get(token);
  if (byId) {
    return byId;
  }
  for (const task of tasks.values()) {
    if (task.runId === token || task.childSessionKey === token || task.taskId === token) {
      return task;
    }
  }
  return undefined;
}

export function markTaskTerminalById(params: {
  taskId: string;
  status: TaskStatus;
  endedAt: number;
  terminalSummary?: string | null;
}): TaskRecord | null {
  const task = tasks.get(params.taskId);
  if (!task) {
    return null;
  }
  task.status = params.status;
  task.endedAt = params.endedAt;
  if (params.terminalSummary !== undefined) {
    task.terminalSummary = params.terminalSummary ?? undefined;
  }
  return task;
}

export function updateTaskNotifyPolicyById(params: {
  taskId: string;
  notifyPolicy: TaskNotifyPolicy;
}): TaskRecord | null {
  const task = tasks.get(params.taskId);
  if (!task) {
    return null;
  }
  task.notifyPolicy = params.notifyPolicy;
  return task;
}

export async function cancelTaskById(params: {
  cfg: CoreBlowConfig;
  taskId: string;
  reason?: string;
}): Promise<DetachedTaskCancelResult> {
  const task = tasks.get(params.taskId);
  if (!task) {
    return {
      found: false,
      cancelled: false,
      reason: "Task not found.",
    };
  }

  const cancelTargetSessionKey = task.childSessionKey ?? task.requesterSessionKey;
  if (controlRuntime?.getAcpSessionManager) {
    const mgr = controlRuntime.getAcpSessionManager();
    await mgr.cancelSession({
      cfg: params.cfg,
      sessionKey: cancelTargetSessionKey,
      reason: params.reason ?? "task-cancel",
    });
  }

  task.status = "cancelled";
  task.endedAt = Date.now();
  if (params.reason) {
    task.terminalSummary = params.reason;
  }

  return {
    found: true,
    cancelled: true,
    task,
  };
}

export function ensureTaskRegistryReady(): void {}
export function deleteTaskRecordById(taskId: string): boolean {
  return tasks.delete(taskId);
}
export function findLatestTaskForFlowId(flowId: string): TaskRecord | undefined {
  const list = listTasksForFlowId(flowId);
  return list[list.length - 1];
}
export function finalizeTaskRunByRunId(): TaskRecord[] {
  return [];
}
export function hasActiveTaskForChildSessionKey(key: string): boolean {
  for (const t of tasks.values()) {
    if (t.childSessionKey === key && (t.status === "queued" || t.status === "running")) {
      return true;
    }
  }
  return false;
}
export function linkTaskToFlowById(params: { taskId: string; flowId: string }): TaskRecord | null {
  const task = tasks.get(params.taskId);
  if (!task) return null;
  task.parentFlowId = params.flowId;
  return task;
}
export function markTaskLostById(taskId: string): TaskRecord | null {
  const task = tasks.get(taskId);
  if (!task) return null;
  task.status = "lost";
  return task;
}
export function markTaskRunningByRunId(runId: string): TaskRecord | null {
  const task = findTaskByRunId(runId);
  if (!task) return null;
  task.status = "running";
  return task;
}
export function maybeDeliverTaskTerminalUpdate(): void {}
export function recordTaskProgressByRunId(params: { runId: string; progressSummary?: string }): TaskRecord | null {
  const task = findTaskByRunId(params.runId);
  if (!task) return null;
  if (params.progressSummary) task.progressSummary = params.progressSummary;
  return task;
}
export function reloadTaskRegistryFromStore(): void {}
export function isParentFlowLinkError(): boolean {
  return false;
}
export function setTaskCleanupAfterById(params: { taskId: string; cleanupAfter: number }): TaskRecord | null {
  const task = tasks.get(params.taskId);
  if (!task) return null;
  task.cleanupAfter = params.cleanupAfter;
  return task;
}
export function setTaskRunDeliveryStatusByRunId(params: { runId: string; deliveryStatus: TaskDeliveryStatus }): TaskRecord | null {
  const task = findTaskByRunId(params.runId);
  if (!task) return null;
  task.deliveryStatus = params.deliveryStatus;
  return task;
}

export type TaskRegistryFacade = Record<string, unknown>;

export const taskRegistry = Object.freeze({
  id: "src/tasks/task-registry.ts",
});
