/** CoreBlow — Exec Approval Surface */
export type ApprovalSurface = "cli" | "web" | "api" | "channel";
export function detectApprovalSurface(env: NodeJS.ProcessEnv = process.env): ApprovalSurface {
  if (env.COREBLOW_CLI === "1") return "cli";
  if (env.COREBLOW_WEB === "1") return "web";
  return "api";
}
