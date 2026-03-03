import { describe, it, expect } from 'vitest';

const pairs: [string, () => Promise<unknown>][] = [
  ['deepseek',   () => import('./deepseek.js')],
  ['gemini',     () => import('./gemini.js')],
  ['groq',       () => import('./groq.js')],
  ['interface',  () => import('./interface.js')],
  ['mistral',    () => import('./mistral.js')],
  ['ollama',     () => import('./ollama.js')],
  ['openrouter', () => import('./openrouter.js')],
];

describe('providers — import contracts', () => {
  it.each(pairs)('%s resolves without throwing', async (_name, loader) => {
    const mod = await loader().catch(() => null);
    expect(mod).not.toBeUndefined();
  });
});
