import type { AutoPilotDiagnostic } from './types.js';
import { diagnostics } from './heartbeat.data.js';
export function getDiagnostics(category?: string): AutoPilotDiagnostic[] {
    if (category) return diagnostics.filter(d => d.category === category);
    return [...diagnostics];
}
