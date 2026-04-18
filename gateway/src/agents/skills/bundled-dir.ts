/** CoreBlow — Skills Bundled Dir */ import path from "node:path"; export function resolveBundledSkillsDir(): string { return path.join(process.cwd(), "skills"); }
