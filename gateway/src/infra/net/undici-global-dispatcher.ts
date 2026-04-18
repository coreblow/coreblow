/** CoreBlow — Undici Global Dispatcher */
import { loadUndiciRuntimeDeps, isUndiciAvailable } from './undici-runtime.js';

export function setGlobalDispatcher(dispatcher: unknown): void {
  if (!isUndiciAvailable()) return;
  try {
    const undici = loadUndiciRuntimeDeps();
    (globalThis as Record<string, unknown>).__undiciDispatcher = dispatcher;
  } catch {}
}

export function getGlobalDispatcher(): unknown {
  return (globalThis as Record<string, unknown>).__undiciDispatcher ?? null;
}
