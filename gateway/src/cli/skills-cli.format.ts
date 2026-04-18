/** CoreBlow — Skills CLI Format */ export function formatSkillInfo(name: string, enabled: boolean): string { return (enabled ? "✅" : "❌") + " " + name; }
