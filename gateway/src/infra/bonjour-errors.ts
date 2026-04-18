/** CoreBlow — Bonjour Errors */
export class BonjourError extends Error { constructor(msg: string) { super(msg); this.name = 'BonjourError'; } }
export class BonjourTimeoutError extends BonjourError { constructor() { super('Discovery timed out'); this.name = 'BonjourTimeoutError'; } }
