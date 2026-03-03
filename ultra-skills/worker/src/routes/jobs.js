// worker/src/routes/jobs.js
// Job queue management

import { json, error, success, paginated } from '../utils/response.js';

export async function handleJobs(request, env, path, method, auth) {
    const id = path.match(/\/api\/jobs\/(\d+)/)?.[1];
    const action = path.match(/\/api\/jobs\/(\d+)\/(cancel|retry)/)?.[2];

    if (action && method === 'POST') {
        return action === 'cancel' ? cancelJob(env, id) : retryJob(env, id);
    }

    // Pending jobs endpoint for GitHub Actions
    if (path === '/api/jobs/pending' && method === 'GET') {
        return getPendingJobs(env);
    }

    switch (method) {
        case 'GET':
            return id ? getJob(env, id) : listJobs(request, env);
        case 'POST':
            return createJob(request, env);
        case 'PUT':
            return id ? updateJob(request, env, id) : error('Job ID required', 400);
        default:
            return error('Method not allowed', 405);
    }
}

async function listJobs(request, env) {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const status_filter = url.searchParams.get('status');
    const targetId = url.searchParams.get('target_id');
    const offset = (page - 1) * limit;

    let where = [];
    const params = [];

    if (status_filter) {
        where.push('status = ?');
        params.push(status_filter);
    }
    if (targetId) {
        where.push('target_id = ?');
        params.push(parseInt(targetId));
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const total = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM scrape_jobs ${whereClause}`
    ).bind(...params).first();

    const jobs = await env.DB.prepare(
        `SELECT j.*, t.name as target_name, t.url as target_url
     FROM scrape_jobs j
     LEFT JOIN scrape_targets t ON j.target_id = t.id
     ${whereClause}
     ORDER BY j.created_at DESC LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    return paginated(jobs.results, total.count, page, limit);
}

async function getJob(env, id) {
    const job = await env.DB.prepare(
        `SELECT j.*, t.name as target_name, t.url as target_url
     FROM scrape_jobs j
     LEFT JOIN scrape_targets t ON j.target_id = t.id
     WHERE j.id = ?`
    ).bind(id).first();

    if (!job) return error('Job not found', 404);
    return json({ success: true, data: job });
}

async function getPendingJobs(env) {
    const jobs = await env.DB.prepare(`
    SELECT j.*, t.name as target_name, t.url as target_url,
           t.selectors, t.selector_type, t.pagination_config,
           t.proxy_required, t.screenshot_enabled, t.headers,
           t.cookies, t.wait_for_selector
    FROM scrape_jobs j
    JOIN scrape_targets t ON j.target_id = t.id
    WHERE j.status = 'pending'
      AND (j.retry_after IS NULL OR j.retry_after <= datetime('now'))
    ORDER BY j.priority ASC, j.created_at ASC
    LIMIT 20
  `).all();

    return json({ success: true, data: jobs.results, count: jobs.results.length });
}

async function createJob(request, env) {
    const body = await request.json();
    const { target_id, url, priority, scheduled_at } = body;

    if (!target_id && !url) return error('target_id or url required', 400);

    let targetUrl = url;
    if (target_id && !url) {
        const target = await env.DB.prepare('SELECT url FROM scrape_targets WHERE id = ?').bind(target_id).first();
        if (!target) return error('Target not found', 404);
        targetUrl = target.url;
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const result = await env.DB.prepare(`
    INSERT INTO scrape_jobs (job_id, target_id, url, priority, scheduled_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
        jobId,
        target_id || null,
        targetUrl,
        priority || 5,
        scheduled_at || null
    ).run();

    return success({ id: result.meta.last_row_id, job_id: jobId, message: 'Job created' }, 201);
}

async function updateJob(request, env, id) {
    const body = await request.json();
    const { status, attempt, started_at, completed_at, duration_ms, error_message } = body;

    const updates = [];
    const values = [];

    if (status) { updates.push('status = ?'); values.push(status); }
    if (attempt !== undefined) { updates.push('attempt = ?'); values.push(attempt); }
    if (started_at) { updates.push('started_at = ?'); values.push(started_at); }
    if (completed_at) { updates.push('completed_at = ?'); values.push(completed_at); }
    if (duration_ms !== undefined) { updates.push('duration_ms = ?'); values.push(duration_ms); }
    if (error_message) { updates.push('error_message = ?'); values.push(error_message); }

    if (updates.length === 0) return error('No fields to update', 400);

    values.push(id);
    await env.DB.prepare(
        `UPDATE scrape_jobs SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    return success({ message: 'Job updated' });
}

async function cancelJob(env, id) {
    await env.DB.prepare(
        "UPDATE scrape_jobs SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('pending', 'running')"
    ).bind(id).run();
    return success({ message: 'Job cancelled' });
}

async function retryJob(env, id) {
    const job = await env.DB.prepare('SELECT * FROM scrape_jobs WHERE id = ?').bind(id).first();
    if (!job) return error('Job not found', 404);

    await env.DB.prepare(
        "UPDATE scrape_jobs SET status = 'pending', attempt = 0, error_message = NULL, retry_after = NULL WHERE id = ?"
    ).bind(id).run();
    return success({ message: 'Job queued for retry' });
}
