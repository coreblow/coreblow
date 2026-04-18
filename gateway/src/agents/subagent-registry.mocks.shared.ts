/** CoreBlow — Subagent Registry Mocks */ export function createMockSubagent(id: string): Record<string, unknown> { return { id, name: "Mock " + id, active: false }; }
