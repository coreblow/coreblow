/** CoreBlow — Suppress Deprecations */ export function suppressDeprecationWarnings(): void { process.removeAllListeners("warning"); }
