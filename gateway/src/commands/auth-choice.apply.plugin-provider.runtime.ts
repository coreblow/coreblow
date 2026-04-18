/** CoreBlow — Auth Choice Apply Plugin Provider Runtime */
let _state: unknown = null;
export function getState(): unknown { return _state; }
export function setState(s: unknown): void { _state = s; }
