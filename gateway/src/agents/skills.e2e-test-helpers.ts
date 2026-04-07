/** E2E test helpers for skills. */ export function createMockSkill(id: string) { return { id, name: id, description: 'mock', category: 'test', enabled: true, version: '1.0.0' }; }
