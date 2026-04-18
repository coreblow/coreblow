/** CoreBlow — Media Note */ export function formatMediaNote(type: string, size: number): string { return "[" + type + " - " + Math.round(size / 1024) + " KB]"; }
