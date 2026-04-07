/** agents/owner-display.ts — Owner/user display formatting. */
export function formatOwner(name?: string, email?: string): string { return name ? (email ? `${name} <${email}>` : name) : 'unknown'; }
