/**
 * utils/debounce.ts
 */
export function debounce<T extends (...args: unknown[]) => any>(fn: T, ms: number): T { let timer: NodeJS.Timeout; return ((...args: unknown[]) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); }) as any; } export function throttle<T extends (...args: unknown[]) => any>(fn: T, ms: number): T { let last = 0; return ((...args: unknown[]) => { const now = Date.now(); if (now - last >= ms) { last = now; return fn(...args); } }) as any; }
