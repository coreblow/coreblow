/** agents/btw.ts — "By the way" message injection for agent hints. */
export function formatBtw(message: string): string { return `\n💡 BTW: ${message}\n`; }
export function shouldShowBtw(turnCount: number, interval = 5): boolean { return turnCount > 0 && turnCount % interval === 0; }
