/** CoreBlow — Sandbox Host Paths */ export function resolveHostWorkDir(): string { return process.env.COREBLOW_SANDBOX_WORKDIR || "/tmp/coreblow-sandbox"; }
