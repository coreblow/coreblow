/** CoreBlow — Daemon Install Runtime Warning */
let _state: unknown = null;
export function getState(): unknown { return _state; }
export function setState(s: unknown): void { _state = s; }
