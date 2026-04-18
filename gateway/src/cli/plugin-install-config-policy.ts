/** CoreBlow — Plugin Install Config Policy */ export type InstallPolicy = "allow-all" | "allowlist" | "deny-all"; export function resolveInstallPolicy(): InstallPolicy { return "allow-all"; }
