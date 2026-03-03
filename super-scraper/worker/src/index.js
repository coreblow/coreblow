// worker/src/index.js
// Super Scraper v2 — Cloudflare Worker API Gateway
// CoreBlow Plan 1 · Production-Grade

import { handleTargets } from './routes/targets.js';
import { handleData } from './routes/data.js';
import { handleJobs } from './routes/jobs.js';
import { handleAuth } from './routes/auth.js';
import { handleExport } from './routes/export.js';
import { verifyAuth } from './middleware/auth.js';
import { rateLimit } from './middleware/rateLimit.js';
import { json, error } from './utils/response.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(env),
      });
    }

    try {
      // Health check
      if (path === '/api/health') {
        return json({ status: 'ok', version: '2.0.0', engine: 'CoreBlow Super Scraper' });
      }

      // Auth routes (no auth required)
      if (path.startsWith('/api/auth')) {
        return addCors(await handleAuth(request, env, path, method), env);
      }

      // Rate limiting
      const rateLimitResult = await rateLimit(request, env);
      if (rateLimitResult) {
        return addCors(rateLimitResult, env);
      }

      // Auth verification for all /api/* routes
      const authResult = await verifyAuth(request, env);
      if (authResult.error) {
        return addCors(error(authResult.error, 401), env);
      }

      // Route dispatch
      let response;

      if (path.startsWith('/api/targets')) {
        response = await handleTargets(request, env, path, method, authResult);
      } else if (path.startsWith('/api/data')) {
        response = await handleData(request, env, path, method, authResult);
      } else if (path.startsWith('/api/jobs')) {
        response = await handleJobs(request, env, path, method, authResult);
      } else if (path.startsWith('/api/export')) {
        response = await handleExport(request, env, path, method, authResult);
      } else if (path === '/api/stats') {
        response = await handleStats(request, env);
      } else {
        response = error('Not Found', 404);
      }

      return addCors(response, env);
    } catch (err) {
      console.error('Worker error:', err);
      return addCors(error(`Internal Server Error: ${err.message}`, 500), env);
    }
  },
};

// Dashboard stats endpoint
async function handleStats(request, env) {
  const targets = await env.DB.prepare('SELECT COUNT(*) as count FROM scrape_targets WHERE is_active = 1').first();
  const jobs = await env.DB.prepare('SELECT COUNT(*) as count FROM scrape_jobs').first();
  const jobsToday = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM scrape_jobs WHERE created_at >= datetime('now', '-1 day')"
  ).first();
  const data = await env.DB.prepare('SELECT COUNT(*) as count FROM scraped_data').first();
  const changes = await env.DB.prepare('SELECT COUNT(*) as count FROM scraped_data WHERE has_changes = 1').first();
  const lastScrape = await env.DB.prepare(
    'SELECT completed_at FROM scrape_jobs WHERE status = ? ORDER BY completed_at DESC LIMIT 1'
  ).bind('success').first();

  return json({
    active_targets: targets?.count || 0,
    total_jobs: jobs?.count || 0,
    jobs_today: jobsToday?.count || 0,
    total_data: data?.count || 0,
    total_changes: changes?.count || 0,
    last_scrape: lastScrape?.completed_at || null,
  });
}

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Max-Age': '86400',
  };
}

function addCors(response, env) {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders(env)).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
