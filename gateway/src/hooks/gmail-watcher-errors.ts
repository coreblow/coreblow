/** CoreBlow — Gmail Watcher Errors */ export class GmailWatcherError extends Error { constructor(message: string) { super(message); this.name = "GmailWatcherError"; } }
