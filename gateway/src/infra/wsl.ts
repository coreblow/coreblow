/** CoreBlow — WSL Detection */
export function isWsl(env: NodeJS.ProcessEnv = process.env): boolean { return Boolean(env.WSL_DISTRO_NAME?.trim() || env.WSLENV?.trim()); }
export function getWslDistro(env: NodeJS.ProcessEnv = process.env): string | null { return env.WSL_DISTRO_NAME?.trim() || null; }
