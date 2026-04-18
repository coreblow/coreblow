/** CoreBlow — Skills Tools Dir */ import path from "node:path"; export function resolveSkillToolsDir(skillDir: string): string { return path.join(skillDir, "tools"); }
