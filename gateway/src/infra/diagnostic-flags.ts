/** CoreBlow — Diagnostic Flags */
const flags = new Map<string, boolean>();
export function setDiagnosticFlag(name: string, value: boolean): void { flags.set(name, value); }
export function getDiagnosticFlag(name: string): boolean { return flags.get(name) ?? false; }
export function isDiagnosticEnabled(name: string): boolean { return getDiagnosticFlag(name); }
export function resetDiagnosticFlags(): void { flags.clear(); }
