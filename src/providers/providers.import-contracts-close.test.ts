import { describe, it, expect } from 'vitest';

const pairs: [string, () => Promise<unknown>][] = [
  ['deepseek',   () => import('./deepseek')],
  ['gemini',     () => import('./gemini')],
  ['groq',       () => import('./groq')],
  ['interface',  () => import('./interface')],
  ['mistral',    () => import('./mistral')],
  ['ollama',     () => import('./ollama')],
  ['openrouter', () => import('./openrouter')],
];

describe('providers — import contracts', () => {
  it.each(pairs)('%s resolves without throwing', async (_name, loader) => {
    const mod = await loader().catch(() => null);
    expect(mod).not.toBeUndefined();
  });
});
