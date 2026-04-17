/** Skills installation. */
export interface SkillInstallResult { skillId: string; success: boolean; version?: string; error?: string; }
export function formatInstallResult(result: SkillInstallResult): string { return result.success ? `✅ Installed ${result.skillId} v${result.version}` : `❌ Failed: ${result.error}`; }
