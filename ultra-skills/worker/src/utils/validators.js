/**
 * worker/src/utils/validators.js
 * Input validation helpers for API routes
 */

/**
 * Validate URL format
 */
function isValidUrl(str) {
    try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Validate cron expression (basic check)
 */
function isValidCron(expr) {
    if (!expr || typeof expr !== 'string') return false;
    const parts = expr.trim().split(/\s+/);
    return parts.length === 5;
}

/**
 * Validate JSON string
 */
function isValidJson(str) {
    if (typeof str !== 'string') return typeof str === 'object';
    try {
        JSON.parse(str);
        return true;
    } catch {
        return false;
    }
}

/**
 * Sanitize string input — trim and limit length
 */
function sanitizeString(str, maxLength = 1000) {
    if (!str || typeof str !== 'string') return '';
    return str.trim().slice(0, maxLength);
}

/**
 * Validate target creation payload
 */
function validateTarget(body) {
    const errors = [];

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
        errors.push('name is required');
    }

    if (!body.url || !isValidUrl(body.url)) {
        errors.push('valid URL is required (http/https)');
    }

    if (body.schedule && !isValidCron(body.schedule)) {
        errors.push('schedule must be a valid cron expression (5 fields)');
    }

    if (body.selectors && typeof body.selectors === 'string' && !isValidJson(body.selectors)) {
        errors.push('selectors must be valid JSON');
    }

    return errors.length > 0 ? errors : null;
}

/**
 * Validate job creation payload
 */
function validateJob(body) {
    const errors = [];

    if (!body.target_id && !body.url) {
        errors.push('either target_id or url is required');
    }

    if (body.url && !isValidUrl(body.url)) {
        errors.push('valid URL is required (http/https)');
    }

    if (body.priority && (body.priority < 1 || body.priority > 10)) {
        errors.push('priority must be between 1 and 10');
    }

    return errors.length > 0 ? errors : null;
}

/**
 * Validate pagination parameters
 */
function validatePagination(query) {
    let page = parseInt(query.page) || 1;
    let limit = parseInt(query.limit) || 20;

    page = Math.max(1, page);
    limit = Math.min(Math.max(1, limit), 100);

    return { page, limit, offset: (page - 1) * limit };
}

module.exports = {
    isValidUrl,
    isValidCron,
    isValidJson,
    sanitizeString,
    validateTarget,
    validateJob,
    validatePagination,
};
