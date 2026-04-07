import crypto from "node:crypto";
export interface OAuthTokens { accessToken: string; refreshToken?: string; expiresAt?: number; }
export function generatePKCE() { const v = crypto.randomBytes(32).toString("base64url"); return { verifier: v, challenge: crypto.createHash("sha256").update(v).digest("base64url") }; }
export function buildAuthUrl(base: string, clientId: string, redirect: string, scope: string, challenge: string) { return `${base}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}&scope=${scope}&code_challenge=${challenge}&response_type=code`; }
export function encryptToken(token: string, key: string) { const iv = crypto.randomBytes(16); const c = crypto.createCipheriv("aes-256-cbc", Buffer.from(key.padEnd(32).slice(0,32)), iv); return iv.toString("hex") + ":" + c.update(token,"utf8","hex") + c.final("hex"); }
export function decryptToken(encrypted: string, key: string) { const [ivH, data] = encrypted.split(":"); const d = crypto.createDecipheriv("aes-256-cbc", Buffer.from(key.padEnd(32).slice(0,32)), Buffer.from(ivH,"hex")); return d.update(data,"hex","utf8") + d.final("utf8"); }
export function needsRefresh(tokens: OAuthTokens) { return tokens.expiresAt ? Date.now() > tokens.expiresAt - 300000 : false; }
