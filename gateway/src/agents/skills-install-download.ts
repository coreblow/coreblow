/** Skill download management. */
export function buildDownloadUrl(registry: string, skillId: string, version: string): string { return `${registry}/${skillId}/${version}.tar.gz`; }
