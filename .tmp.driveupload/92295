/**
 * security/api-key-validator.ts
 */
export function validateApiKey(key: string) { if (!key) return {valid: false, reason: 'Key is empty'}; if (key.length < 20) return {valid: false, reason: 'Key too short'}; return {valid: true}; }
