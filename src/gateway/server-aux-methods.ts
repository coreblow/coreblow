export const GATEWAY_AUX_METHODS = [
  "exec.approval.request",
  "exec.approval.waitDecision",
  "exec.approval.resolve",
  "plugin.approval.request",
  "plugin.approval.waitDecision",
  "plugin.approval.resolve",
  "secrets.reload",
  "secrets.resolve",
] as const;

export type GatewayAuxMethod = (typeof GATEWAY_AUX_METHODS)[number];
