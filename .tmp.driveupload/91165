/** Skill status reporting. */
export type SkillStatus = 'installed' | 'available' | 'outdated' | 'error';
export function formatSkillStatus(name: string, status: SkillStatus): string { const icons: Record<SkillStatus, string> = { installed: '✅', available: '📦', outdated: '🔄', error: '❌' }; return `${icons[status]} ${name}: ${status}`; }
