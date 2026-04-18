/** CoreBlow — Install Spec */ export function parseInstallSpec(spec: string): { name: string; version?: string } { const parts = spec.split("@"); return { name: parts[0], version: parts[1] }; }
