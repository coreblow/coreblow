// worker/src/utils/response.js
// JSON response helpers

export function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

export function error(message, status = 400) {
    return json({ success: false, error: message }, status);
}

export function success(data, status = 200) {
    return json({ success: true, ...data }, status);
}

export function paginated(items, total, page, limit) {
    return json({
        success: true,
        data: items,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        },
    });
}
