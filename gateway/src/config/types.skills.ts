/** CoreBlow — Types: Skills */ export interface SkillConfig { name: string; enabled: boolean; model?: string; maxTokens?: number; } export type SkillsConfig = Record<string, SkillConfig>;
