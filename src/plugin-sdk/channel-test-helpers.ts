export function createPluginRuntimeMock(overrides: Record<string, unknown> = {}) {
  return {
    channel: {},
    agent: {},
    llm: {},
    ...overrides,
  };
}
