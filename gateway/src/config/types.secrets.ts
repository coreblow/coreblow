/** CoreBlow — Types: Secrets */ export type SecretSource = "env" | "file" | "vault" | "inline"; export interface SecretRef { source: SecretSource; key: string; }
