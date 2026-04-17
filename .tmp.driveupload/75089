// worker/src/middleware/rateLimit.js
// Simple in-memory rate limiting (per-request IP)

const rateLimitMap = new Map();
const WINDOW_MS = 60_000; // 1 minute

export async function rateLimit(request, env) {
    const limit = parseInt(env.RATE_LIMIT_PER_MINUTE || '60');
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const key = `rl:${ip}`;
    const now = Date.now();

    let entry = rateLimitMap.get(key);
    if (!entry || now - entry.windowStart > WINDOW_MS) {
        entry = { windowStart: now, count: 0 };
    }

    entry.count++;
    rateLimitMap.set(key, entry);

    // Cleanup old entries periodically
    if (rateLimitMap.size > 10000) {
        for (const [k, v] of rateLimitMap) {
            if (now - v.windowStart > WINDOW_MS) rateLimitMap.delete(k);
        }
    }

    if (entry.count > limit) {
        const retryAfter = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
        return new Response(JSON.stringify({
            success: false,
            error: 'Rate limit exceeded',
            retry_after: retryAfter,
        }), {
            status: 429,
            headers: {
                'Content-Type': 'application/json',
                'Retry-After': String(retryAfter),
                'X-RateLimit-Limit': String(limit),
                'X-RateLimit-Remaining': '0',
            },
        });
    }

    return null; // No rate limit hit
}
