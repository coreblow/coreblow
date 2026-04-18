/** CoreBlow — Thread Binding ID */ export function createThreadBindingId(channelId: string, threadId: string): string { return channelId + "::thread::" + threadId; }
