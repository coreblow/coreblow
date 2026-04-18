/** CoreBlow — Config Presence */ export function hasChannelConfig(config: Record<string, unknown>, channelType: string): boolean { return config[channelType] !== undefined; }
