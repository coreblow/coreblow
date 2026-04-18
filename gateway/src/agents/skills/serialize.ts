/** CoreBlow — Skills Serialize */ export function serializeSkill(skill: Record<string, unknown>): string { return JSON.stringify(skill, null, 2); }
