/** CoreBlow — Channel Configured Check */
export interface ChannelConfigured { channelType: string; configured: boolean; errors: string[]; }
export function isChannelConfigured(config: Record<string, unknown>, requiredKeys: string[]): ChannelConfigured { const errors: string[] = []; for (const key of requiredKeys) { if (!config[key]) errors.push("Missing required field: " + key); } return { channelType: String(config.channelType ?? "unknown"), configured: errors.length === 0, errors }; }
