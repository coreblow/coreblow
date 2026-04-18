/** CoreBlow — Message Mirror */
export interface MirrorConfig { sourceChannelId: string; targetChannelIds: string[]; enabled: boolean; }
export function shouldMirror(config: MirrorConfig, channelId: string): boolean { return config.enabled && config.sourceChannelId === channelId; }
