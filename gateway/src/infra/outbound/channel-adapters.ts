/** CoreBlow — Channel Adapters */
export interface ChannelAdapter { name: string; type: string; send(message: unknown): Promise<boolean>; isConnected(): boolean; }
const adapters = new Map<string, ChannelAdapter>();
export function registerAdapter(adapter: ChannelAdapter): void { adapters.set(adapter.name, adapter); }
export function getAdapter(name: string): ChannelAdapter | undefined { return adapters.get(name); }
export function getAllAdapters(): ChannelAdapter[] { return [...adapters.values()]; }
