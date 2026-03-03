/**
 * routing/channel-router.ts
 */
export class ChannelRouter { private handlers = new Map<string, Function>(); register(channel: string, handler: Function) { this.handlers.set(channel, handler); } async route(channel: string, message: unknown) { const h = this.handlers.get(channel); if (!h) return null; return h(message); } hasChannel(ch: string) { return this.handlers.has(ch); } }
