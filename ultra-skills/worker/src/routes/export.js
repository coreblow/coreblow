// worker/src/routes/export.js
// Data export endpoints (CSV, JSON)

import { json, error } from '../utils/response.js';

export async function handleExport(request, env, path, method, auth) {
    if (method !== 'GET') return error('Method not allowed', 405);

    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';
    const targetId = url.searchParams.get('target_id');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '1000'), 10000);

    let where = '';
    const params = [];
    if (targetId) {
        where = 'WHERE target_id = ?';
        params.push(parseInt(targetId));
    }

    const data = await env.DB.prepare(
        `SELECT d.*, t.name as target_name
     FROM scraped_data d
     LEFT JOIN scrape_targets t ON d.target_id = t.id
     ${where}
     ORDER BY d.created_at DESC LIMIT ?`
    ).bind(...params, limit).all();

    if (format === 'csv') {
        return exportCsv(data.results);
    }

    return json({
        success: true,
        data: data.results,
        count: data.results.length,
        exported_at: new Date().toISOString(),
    });
}

function exportCsv(rows) {
    if (rows.length === 0) {
        return new Response('No data to export', { status: 200 });
    }

    const headers = ['id', 'target_name', 'url', 'title', 'status', 'has_changes', 'page_number', 'created_at'];
    const csvRows = [headers.join(',')];

    for (const row of rows) {
        const values = headers.map(h => {
            const val = row[h] ?? '';
            const str = String(val).replace(/"/g, '""');
            return `"${str}"`;
        });
        csvRows.push(values.join(','));
    }

    return new Response(csvRows.join('\n'), {
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="ultra-skills-export-${Date.now()}.csv"`,
        },
    });
}
