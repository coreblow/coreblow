/** CoreBlow — Threading Helpers */ export function isThreadReply(meta: Record<string, unknown>): boolean { return Boolean(meta.threadId || meta.replyTo); }
