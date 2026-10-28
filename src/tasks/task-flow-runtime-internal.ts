export {
  createTaskFlowForTask,
  createManagedTaskFlow,
  deleteTaskFlowRecordById,
  failFlow,
  finishFlow,
  getTaskFlowById,
  listTaskFlowRecords,
  requestFlowCancel,
  resolveTaskFlowForLookupToken,
  resetTaskFlowRegistryForTests,
  resumeFlow,
  setFlowWaiting,
  syncFlowFromTask,
  updateFlowRecordByIdExpectedRevision,
} from "./task-flow-registry.js";

export type { TaskFlowUpdateResult } from "./task-flow-registry.js";

export type TaskFlowRuntimeInternalFacade = Record<string, unknown>;

export const taskFlowRuntimeInternal = Object.freeze({
  id: "src/tasks/task-flow-runtime-internal.ts",
});
