import type { CoreBlowConfig } from "../config/types.coreblow.js";
import {
  getRegisteredDetachedTaskLifecycleRuntime,
} from "./detached-task-runtime-state.js";
import {
  cancelTaskById,
  createTaskRecord,
  getTaskById,
  listTasksForFlowId,
} from "./runtime-internal.js";
import { getTaskFlowByIdForOwner } from "./task-flow-owner-access.js";
import type { TaskFlowRecord } from "./task-flow-registry.types.js";
import { summarizeTaskRecords } from "./task-registry.summary.js";
import type {
  TaskDeliveryStatus,
  TaskNotifyPolicy,
  TaskRecord,
  TaskRegistrySummary,
  TaskRuntime,
} from "./task-registry.types.js";

export function getFlowTaskSummary(flowId: string): TaskRegistrySummary {
  return summarizeTaskRecords(listTasksForFlowId(flowId));
}

export function createRunningTaskRun(params: {
  runtime: TaskRuntime;
  task: string;
  requesterSessionKey?: string;
  ownerKey?: string;
  childSessionKey?: string;
  parentFlowId?: string;
  agentId?: string;
  runId?: string;
  label?: string;
  startedAt?: number;
  lastEventAt?: number;
  progressSummary?: string | null;
}): TaskRecord {
  return createTaskRecord({
    ...params,
    status: "running",
  });
}

export function createQueuedTaskRun(params: {
  runtime: TaskRuntime;
  task: string;
  requesterSessionKey?: string;
  ownerKey?: string;
  childSessionKey?: string;
  parentFlowId?: string;
  agentId?: string;
  runId?: string;
  label?: string;
}): TaskRecord {
  return createTaskRecord({
    ...params,
    status: "queued",
  });
}

export function startTaskRunByRunId(): TaskRecord[] { return []; }
export function recordTaskRunProgressByRunId(): TaskRecord[] { return []; }
export function finalizeTaskRunByRunId(): TaskRecord[] { return []; }
export function completeTaskRunByRunId(): TaskRecord[] { return []; }
export function failTaskRunByRunId(): TaskRecord[] { return []; }
export function setDetachedTaskDeliveryStatusByRunId(): TaskRecord[] { return []; }

export type RunTaskInFlowResult =
  | { created: true; flow: TaskFlowRecord; task: TaskRecord }
  | { created: false; found: boolean; reason?: string; flow?: TaskFlowRecord };

export function runTaskInFlowForOwner(params: {
  flowId: string;
  callerOwnerKey: string;
  runtime: TaskRuntime;
  sourceId?: string;
  childSessionKey?: string;
  parentTaskId?: string;
  agentId?: string;
  runId?: string;
  label?: string;
  task: string;
  preferMetadata?: boolean;
  notifyPolicy?: TaskNotifyPolicy;
  deliveryStatus?: TaskDeliveryStatus;
  status?: "queued" | "running";
  startedAt?: number;
  lastEventAt?: number;
  progressSummary?: string | null;
}): RunTaskInFlowResult {
  const flow = getTaskFlowByIdForOwner({
    flowId: params.flowId,
    callerOwnerKey: params.callerOwnerKey,
  });
  if (!flow) {
    return {
      found: false,
      created: false,
      reason: "TaskFlow not found.",
    };
  }

  const createdTask = createTaskRecord({
    runtime: params.runtime,
    sourceId: params.sourceId,
    requesterSessionKey: params.callerOwnerKey,
    ownerKey: params.callerOwnerKey,
    scopeKind: "session",
    parentFlowId: flow.flowId,
    childSessionKey: params.childSessionKey,
    parentTaskId: params.parentTaskId,
    agentId: params.agentId,
    runId: params.runId,
    label: params.label,
    task: params.task,
    status: params.status ?? "running",
    deliveryStatus: params.deliveryStatus ?? "pending",
    notifyPolicy: params.notifyPolicy ?? flow.notifyPolicy,
    startedAt: params.startedAt ?? Date.now(),
    lastEventAt: params.lastEventAt ?? Date.now(),
    progressSummary: params.progressSummary,
  });

  return {
    created: true,
    flow,
    task: createdTask,
  };
}

export async function cancelFlowByIdForOwner(params: {
  cfg: CoreBlowConfig;
  flowId: string;
  callerOwnerKey: string;
}) {
  const flow = getTaskFlowByIdForOwner({
    flowId: params.flowId,
    callerOwnerKey: params.callerOwnerKey,
  });
  if (!flow) {
    return {
      found: false,
      cancelled: false,
      reason: "TaskFlow not found.",
    };
  }
  const tasksInFlow = listTasksForFlowId(flow.flowId);
  for (const t of tasksInFlow) {
    await cancelTaskById({ cfg: params.cfg, taskId: t.taskId });
  }
  flow.status = "cancelled";
  flow.endedAt = Date.now();
  return {
    found: true,
    cancelled: true,
    flow,
    tasks: tasksInFlow,
  };
}

export async function cancelDetachedTaskRunById(params: { cfg: CoreBlowConfig; taskId: string }) {
  const task = getTaskById(params.taskId);
  if (!task) {
    return await cancelTaskById(params);
  }
  const registeredRuntime = getRegisteredDetachedTaskLifecycleRuntime();
  if (registeredRuntime) {
    const cancelled = await registeredRuntime.cancelDetachedTaskRunById(params);
    if (cancelled.found) {
      return cancelled;
    }
  }
  return await cancelTaskById(params);
}

export type TaskExecutorFacade = Record<string, unknown>;

export const taskExecutor = Object.freeze({
  id: "src/tasks/task-executor.ts",
});
