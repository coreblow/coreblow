export {
  cancelTaskById,
  createTaskRecord,
  deleteTaskRecordById,
  ensureTaskRegistryReady,
  resetTaskRegistryControlRuntimeForTests,
  findLatestTaskForFlowId,
  finalizeTaskRunByRunId,
  getTaskById,
  hasActiveTaskForChildSessionKey,
  listTaskRecords,
  listTasksForFlowId,
  listTasksForOwnerKey,
  linkTaskToFlowById,
  markTaskLostById,
  markTaskRunningByRunId,
  markTaskTerminalById,
  maybeDeliverTaskTerminalUpdate,
  recordTaskProgressByRunId,
  reloadTaskRegistryFromStore,
  resetTaskRegistryDeliveryRuntimeForTests,
  resolveTaskForLookupToken,
  resetTaskRegistryForTests,
  isParentFlowLinkError,
  setTaskRegistryControlRuntimeForTests,
  setTaskRegistryDeliveryRuntimeForTests,
  setTaskCleanupAfterById,
  setTaskRunDeliveryStatusByRunId,
  updateTaskNotifyPolicyById,
} from "./task-registry.js";

export type RuntimeInternalFacade = Record<string, unknown>;

export const runtimeInternal = Object.freeze({
  id: "src/tasks/runtime-internal.ts",
});
