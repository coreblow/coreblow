/** CoreBlow — PI Wait For Idle Before Flush */ export async function waitForIdleBeforeFlush(timeoutMs = 5000): Promise<void> { await new Promise((r) => setTimeout(r, Math.min(timeoutMs, 100))); }
