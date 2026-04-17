/**
 * routing/message-router.ts
 */
export class MessageRouter { private routes: Array<{pattern: RegExp; handler: Function}> = []; add(pattern: string, handler: Function) { this.routes.push({pattern: new RegExp(pattern, 'i'), handler}); } async route(text: string, ctx: unknown) { for (const r of this.routes) { if (r.pattern.test(text)) return r.handler(text, ctx); } return null; } }
