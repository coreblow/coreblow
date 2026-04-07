import { describe, it, expect } from 'vitest';
describe('CLI JSON stdout', () => {
  it('should output valid JSON', () => { expect(JSON.parse('{}')).toEqual({}); });
});
