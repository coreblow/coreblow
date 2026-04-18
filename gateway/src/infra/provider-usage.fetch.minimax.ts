/** CoreBlow — Provider Usage Fetch Minimax */ export function resolveMinimaxApiKey(env: NodeJS.ProcessEnv = process.env): string | undefined { return env.MINIMAX_API_KEY?.trim(); }
