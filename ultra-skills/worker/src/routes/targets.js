// worker/src/routes/targets.js
// Scrape target CRUD operations

import { json, error, success, paginated } from '../utils/response.js';

export async function handleTargets(request, env, path, method, auth) {
    const id = path.match(/\/api\/targets\/(\d+)/)?.[1];

    switch (method) {
        case 'GET':
            return id ? getTarget(env, id) : listTargets(request, env);
        case 'POST':
            return createTarget(request, env);
        case 'PUT':
            return id ? updateTarget(request, env, id) : error('Target ID required', 400);
        case 'DELETE':
            return id ? deleteTarget(env, id) : error('Target ID required', 400);
        default:
            return error('Method not allowed', 405);
    }
}

async function listTargets(request, env) {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const active = url.searchParams.get('active');
    const offset = (page - 1) * limit;

    let where = '';
    const params = [];
    if (active !== null && active !== undefined && active !== '') {
        where = 'WHERE is_active = ?';
        params.push(parseInt(active));
    }

    const total = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM scrape_targets ${where}`
    ).bind(...params).first();

    const targets = await env.DB.prepare(
        `SELECT * FROM scrape_targets ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    return paginated(targets.results, total.count, page, limit);
}

async function getTarget(env, id) {
    const target = await env.DB.prepare(
        'SELECT * FROM scrape_targets WHERE id = ?'
    ).bind(id).first();

    if (!target) return error('Target not found', 404);

    // Get recent jobs for this target
    const recentJobs = await env.DB.prepare(
        'SELECT * FROM scrape_jobs WHERE target_id = ? ORDER BY created_at DESC LIMIT 5'
    ).bind(id).all();

    // Get data count
    const dataCount = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM scraped_data WHERE target_id = ?'
    ).bind(id).first();

    return json({
        success: true,
        data: {
            ...target,
            recent_jobs: recentJobs.results,
            data_count: dataCount.count,
        },
    });
}

async function createTarget(request, env) {
    const body = await request.json();
    const { name, url, selectors, selector_type, schedule, pagination_config,
        proxy_required, screenshot_enabled, notify_on_change_only,
        notification_channels, webhook_url, headers, cookies, wait_for_selector } = body;

    if (!name || !url) {
        return error('Name and URL are required', 400);
    }

    // Validate URL
    try { new URL(url); } catch { return error('Invalid URL', 400); }

    const result = await env.DB.prepare(`
    INSERT INTO scrape_targets (name, url, selectors, selector_type, schedule,
      pagination_config, proxy_required, screenshot_enabled, notify_on_change_only,
      notification_channels, webhook_url, headers, cookies, wait_for_selector)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
        name, url,
        JSON.stringify(selectors || {}),
        selector_type || 'css',
        schedule || '0 */6 * * *',
        JSON.stringify(pagination_config || null),
        proxy_required ? 1 : 0,
        screenshot_enabled ? 1 : 0,
        notify_on_change_only ? 1 : 0,
        JSON.stringify(notification_channels || ['telegram']),
        webhook_url || null,
        JSON.stringify(headers || {}),
        JSON.stringify(cookies || {}),
        wait_for_selector || null
    ).run();

    // Audit log
    await env.DB.prepare(
        'INSERT INTO audit_logs (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)'
    ).bind('create', 'target', result.meta.last_row_id, JSON.stringify({ name, url })).run();

    return success({ id: result.meta.last_row_id, message: 'Target created' }, 201);
}

async function updateTarget(request, env, id) {
    const existing = await env.DB.prepare('SELECT * FROM scrape_targets WHERE id = ?').bind(id).first();
    if (!existing) return error('Target not found', 404);

    const body = await request.json();
    const fields = ['name', 'url', 'selectors', 'selector_type', 'schedule',
        'pagination_config', 'proxy_required', 'screenshot_enabled',
        'notify_on_change_only', 'notification_channels', 'webhook_url',
        'headers', 'cookies', 'wait_for_selector', 'is_active'];

    const updates = [];
    const values = [];

    for (const field of fields) {
        if (body[field] !== undefined) {
            updates.push(`${field} = ?`);
            const val = body[field];
            values.push(typeof val === 'object' ? JSON.stringify(val) : val);
        }
    }

    if (updates.length === 0) return error('No fields to update', 400);

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await env.DB.prepare(
        `UPDATE scrape_targets SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    await env.DB.prepare(
        'INSERT INTO audit_logs (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)'
    ).bind('update', 'target', id, JSON.stringify(body)).run();

    return success({ message: 'Target updated' });
}

async function deleteTarget(env, id) {
    const existing = await env.DB.prepare('SELECT * FROM scrape_targets WHERE id = ?').bind(id).first();
    if (!existing) return error('Target not found', 404);

    await env.DB.prepare('DELETE FROM scrape_targets WHERE id = ?').bind(id).run();

    await env.DB.prepare(
        'INSERT INTO audit_logs (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)'
    ).bind('delete', 'target', id, JSON.stringify({ name: existing.name })).run();

    return success({ message: 'Target deleted' });
}
