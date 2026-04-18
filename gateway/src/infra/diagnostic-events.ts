/** CoreBlow — Diagnostic Events */
export type DiagnosticLevel = "info" | "warning" | "error" | "critical";
export interface DiagnosticEvent { level: DiagnosticLevel; source: string; message: string; timestamp: number; details?: Record<string, unknown>; }
const events: DiagnosticEvent[] = [];
export function recordDiagnostic(event: Omit<DiagnosticEvent, "timestamp">): void { events.push({ ...event, timestamp: Date.now() }); }
export function getDiagnosticEvents(level?: DiagnosticLevel): DiagnosticEvent[] { return level ? events.filter((e) => e.level === level) : [...events]; }
export function clearDiagnostics(): void { events.length = 0; }
