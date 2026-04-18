/** CoreBlow — Gmail Setup Utils */ export function validateGmailCredentials(creds: Record<string, unknown>): boolean { return Boolean(creds.clientId && creds.clientSecret); }
