/** CoreBlow — Target Errors */
export class TargetNotFoundError extends Error { constructor(targetId: string) { super("Target not found: " + targetId); this.name = "TargetNotFoundError"; } }
export class TargetUnavailableError extends Error { constructor(targetId: string) { super("Target unavailable: " + targetId); this.name = "TargetUnavailableError"; } }
