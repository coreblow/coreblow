/** CoreBlow — Channel Logging */ export function logChannelEvent(channelType: string, event: string, details?: unknown): void { console.log("[channel:" + channelType + "] " + event); }
