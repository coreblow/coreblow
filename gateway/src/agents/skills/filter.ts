/** CoreBlow — Skills Filter */ export function filterEnabledSkills(skills: Array<{ enabled: boolean }>): Array<{ enabled: boolean }> { return skills.filter((s) => s.enabled); }
