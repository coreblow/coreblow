/**
 * utils/date-utils.ts
 */
export function daysAgo(n: number): Date { const d = new Date(); d.setDate(d.getDate() - n); return d; } export function isToday(d: Date): boolean { const now = new Date(); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate(); } export function formatRelative(d: Date): string { const ms = Date.now() - d.getTime(); if (ms < 60000) return 'just now'; if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`; if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`; return `${Math.floor(ms / 86400000)}d ago`; }
