/** CoreBlow — FS Bridge Rename Targets */ export function validateRenameTarget(from: string, to: string): boolean { return from !== to && !to.includes(".."); }
