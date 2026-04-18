/** CoreBlow — Read-Only Account Inspect */ export function inspectAccount(channelType: string): Record<string, unknown> { return { channelType, readOnly: true }; }
