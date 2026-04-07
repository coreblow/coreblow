/** PTY key sequence mapping. */
export const KEY_MAP: Record<string, string> = { up: '\x1b[A', down: '\x1b[B', right: '\x1b[C', left: '\x1b[D', enter: '\r', tab: '\t', escape: '\x1b', backspace: '\x7f' };
export function getKeySequence(key: string): string { return KEY_MAP[key] ?? key; }
