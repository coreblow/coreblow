export function createRuntimeTaskFlow() {
  const flows: unknown[] = [];
  return {
    flows,
    async createFlow(input: unknown) {
      flows.push(input);
      return { flowId: `flow-${flows.length}`, revision: 0, ...(input as object) };
    },
  };
}
