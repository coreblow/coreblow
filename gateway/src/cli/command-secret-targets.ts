/** CoreBlow — Command Secret Targets */ export type SecretTarget = "env" | "file" | "config"; export function resolveSecretTarget(): SecretTarget { return "env"; }
