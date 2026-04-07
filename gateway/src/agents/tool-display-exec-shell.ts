/** Shell exec display. */
export function formatShellPrompt(cwd?: string): string { return `${cwd ?? '~'} $`; }
