/** CoreBlow — CLI Ports */ export function resolvePort(env: NodeJS.ProcessEnv = process.env): number { return parseInt(env.COREBLOW_PORT ?? "3000", 10); }
