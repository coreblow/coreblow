import { describe, it, expect } from 'vitest';
import { WorkflowShellExtension } from '../extension.js';

describe('WorkflowShellExtension', () => {
  it('should initialize', async () => {
    const ext = new WorkflowShellExtension();
    expect(ext.name).toBe('workflow-shell');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new WorkflowShellExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new WorkflowShellExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
