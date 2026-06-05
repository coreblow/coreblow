export type TestTaskRecord = { taskId: string; [key: string]: unknown };
export type TestTaskDeliveryState = { taskId: string; [key: string]: unknown };

export type TestTaskRegistryStoreSnapshot = {
  tasks: Map<string, TestTaskRecord>;
  deliveryStates: Map<string, TestTaskDeliveryState>;
};

export type TestTaskRegistryStore = {
  loadSnapshot: () => TestTaskRegistryStoreSnapshot;
  saveSnapshot: (snapshot: TestTaskRegistryStoreSnapshot) => void;
  upsertTask: (task: TestTaskRecord) => void;
  deleteTask: (taskId: string) => void;
  upsertDeliveryState: (state: TestTaskDeliveryState) => void;
  deleteDeliveryState: (taskId: string) => void;
};

export function installInMemoryTaskRegistryRuntime(): {
  taskStore: TestTaskRegistryStore;
} {
  let snapshot: TestTaskRegistryStoreSnapshot = {
    tasks: new Map(),
    deliveryStates: new Map(),
  };
  const taskStore: TestTaskRegistryStore = {
    loadSnapshot: () => ({
      tasks: new Map(snapshot.tasks),
      deliveryStates: new Map(snapshot.deliveryStates),
    }),
    saveSnapshot: (next) => {
      snapshot = {
        tasks: new Map(next.tasks),
        deliveryStates: new Map(next.deliveryStates),
      };
    },
    upsertTask: (task) => snapshot.tasks.set(task.taskId, { ...task }),
    deleteTask: (taskId) => {
      snapshot.tasks.delete(taskId);
    },
    upsertDeliveryState: (state) => snapshot.deliveryStates.set(state.taskId, { ...state }),
    deleteDeliveryState: (taskId) => {
      snapshot.deliveryStates.delete(taskId);
    },
  };
  return { taskStore };
}
