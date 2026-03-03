// worker/src/routes/data.js
// Scraped data CRUD + search

import { json, error, success, paginated } from '../utils/response.js';

export async function handleData(request, env, path, method, auth) {
    const id = path.match(/\/api\/data\/(\d+)/)?.[1];

    switch (method) {
        case 'GET':
            return id ? getData(env, id) : listData(request, env);
        case 'POST':
            return createData(request, env);
        case 'DELETE':
            return id ? deleteData(env, id) : error('Data ID required', 400);
        default:
            return error('Method not allowed', 405);
    }
}

async function listData(request, env) {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const targetId = url.searchParams.get('target_id');
    const hasChanges = url.searchParams.get('has_changes');
    const search = url.searchParams.get('search');
    const offset = (page - 1) * limit;

    let where = [];
    const params = [];

    if (targetId) {
        where.push('target_id = ?');
        params.push(parseInt(targetId));
    }
    if (hasChanges === '1') {
        where.push('has_changes = 1');
    }
    if (search) {
        where.push('(title LIKE ? OR content LIKE ? OR url LIKE ?)');
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const total = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM scraped_data ${whereClause}`
    ).bind(...params).first();

    const data = await env.DB.prepare(
        `SELECT id, target_id, url, title, status, has_changes, content_hash,
            page_number, screenshot_url, created_at, updated_at
     FROM scraped_data ${whereClause}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    return paginated(data.results, total.count, page, limit);
}

async function getData(env, id) {
    const data = await env.DB.prepare(
        'SELECT * FROM scraped_data WHERE id = ?'
    ).bind(id).first();

    if (!data) return error('Data not found', 404);
    return json({ success: true, data });
}

async function createData(request, env) {
    const body = await request.json();
    const { target_id, url, title, content, extracted_data, metadata,
        status, content_hash, previous_hash, has_changes,
        screenshot_url, page_number } = body;

    if (!url) return error('URL is required', 400);

    const result = await env.DB.prepare(`
    INSERT INTO scraped_data (target_id, url, title, content, extracted_data,
      metadata, status, content_hash, previous_hash, has_changes,
      screenshot_url, page_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
        target_id || null, url, title || null, content || null,
        JSON.stringify(extracted_data || null),
        JSON.stringify(metadata || null),
        status || 'success',
        content_hash || null, previous_hash || null,
        has_changes ? 1 : 0,
        screenshot_url || null, page_number || 1
    ).run();

    // Update target last_scraped_at
    if (target_id) {
        await env.DB.prepare(
            'UPDATE scrape_targets SET last_scraped_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind(target_id).run();
    }

    return success({ id: result.meta.last_row_id, message: 'Data stored' }, 201);
}

async function deleteData(env, id) {
    const existing = await env.DB.prepare('SELECT id FROM scraped_data WHERE id = ?').bind(id).first();
    if (!existing) return error('Data not found', 404);

    await env.DB.prepare('DELETE FROM scraped_data WHERE id = ?').bind(id).run();
    return success({ message: 'Data deleted' });
}
