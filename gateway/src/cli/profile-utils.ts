/** CoreBlow — Profile Utils */ export function resolveProfile(env: NodeJS.ProcessEnv = process.env): string { return env.COREBLOW_PROFILE?.trim() || "default"; }
