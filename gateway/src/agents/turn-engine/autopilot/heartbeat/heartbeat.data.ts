/**
 * heartbeat.data.ts — Shared heartbeat diagnostic data store
 */
import type { AutoPilotDiagnostic } from './types.js';

export type DiagnosticEntry = AutoPilotDiagnostic;
export const diagnostics: DiagnosticEntry[] = [];
