/** Runtime auth token refresh. */
export async function refreshAuthToken(refreshToken: string, endpoint: string): Promise<{ accessToken: string; expiresAt: number } | null> {
    try { const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: refreshToken }) }); if (!res.ok) return null; return await res.json() as { accessToken: string; expiresAt: number }; } catch { return null; }
}
