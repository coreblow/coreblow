/** CoreBlow — Auth Install Policy */ export type AuthInstallPolicy = "required" | "optional" | "none"; export function resolveAuthInstallPolicy(): AuthInstallPolicy { return "optional"; }
