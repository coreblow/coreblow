/** CoreBlow — Update CLI Shared */ export function getUpdateChannel(): string { return process.env.COREBLOW_UPDATE_CHANNEL || "stable"; }
