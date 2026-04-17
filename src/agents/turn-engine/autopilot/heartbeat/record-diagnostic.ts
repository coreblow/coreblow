import type { AutoPilotDiagnostic } from './types.js';
import { diagnostics } from './heartbeat.data.js';
export function recordDiagnostic(diag: Omit<AutoPilotDiagnostic, 'timestamp'>): void { diagnostics.push({ ...diag, timestamp: Date.now() }); }
