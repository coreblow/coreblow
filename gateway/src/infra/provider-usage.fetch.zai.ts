/** CoreBlow — Provider Usage Fetch ZAI */ export function resolveZaiApiKey(env: NodeJS.ProcessEnv = process.env): string | undefined { return env.ZAI_API_KEY?.trim() || env.Z_AI_API_KEY?.trim(); }
