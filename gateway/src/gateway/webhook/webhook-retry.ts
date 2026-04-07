/**
 * gateway/webhook/webhook-retry.ts
 */
export async function webhookWithRetry(url: string, payload: unknown, maxRetries = 3) { for (let i = 0; i <= maxRetries; i++) { try { const r = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)}); if (r.ok) return r; } catch { /* intentionally ignored */ } if (i < maxRetries) await new Promise(r => setTimeout(r, 1000 * (i + 1))); } throw new Error('Webhook delivery failed'); }
