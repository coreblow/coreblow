/** CoreBlow — Provider Usage Fetch Codex */ export function resolveCodexApiKey(env: NodeJS.ProcessEnv = process.env): string | undefined { return env.OPENAI_API_KEY?.trim(); }
