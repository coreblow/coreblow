/** CoreBlow — Google API Base URL */
export function resolveGoogleApiBaseUrl(env: NodeJS.ProcessEnv = process.env): string { return env.GOOGLE_API_BASE_URL?.trim() || "https://generativelanguage.googleapis.com"; }
