/** CoreBlow — Thread Bindings Messages */ export function isThreadMessage(meta: { threadId?: string }): boolean { return Boolean(meta.threadId); }
