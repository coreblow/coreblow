/**
 * CoreBlow — Input Sanitization Utilities
 *
 * Central module for sanitizing user-supplied inputs before
 * they reach dangerous sinks (shell, filesystem, eval).
 */

// ═══════════════════════════════════════════════════════════════
// SHELL ARGUMENT SANITIZATION
// ═══════════════════════════════════════════════════════════════

/**
 * Sanitize a string for safe inclusion as a shell argument.
 * Wraps in single quotes and escapes internal single quotes.
 */
export function sanitizeShellArg(input: string): string {
    if (!input) return "''";
    return "'" + input.replace(/'/g, "'\\''") + "'";
}

/**
 * Validate that a command name contains only safe characters.
 */
export function isValidCommandName(name: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(name);
}

/**
 * Sanitize an array of arguments for shell execution.
 */
export function sanitizeShellArgs(args: string[]): string[] {
    return args.map(sanitizeShellArg);
}

// ═══════════════════════════════════════════════════════════════
// PATH SANITIZATION
// ═══════════════════════════════════════════════════════════════

/**
 * Remove path traversal sequences from user input.
 */
export function sanitizePath(input: string): string {
    return input
        .replace(/\.\.\//g, '')
        .replace(/\.\.\\/g, '')
        .replace(/\0/g, '')
        .replace(/[<>:"|?*]/g, '')
        .trim();
}

/**
 * Validate a filename (no path separators, no traversal).
 */
export function isValidFilename(name: string): boolean {
    if (!name || name === '.' || name === '..') return false;
    if (name.length > 255) return false;
    return /^[a-zA-Z0-9._-]+$/.test(name);
}

// ═══════════════════════════════════════════════════════════════
// EXPRESSION VALIDATION
// ═══════════════════════════════════════════════════════════════

const DANGEROUS_PATTERNS = [
    'require(', 'import(', 'process.', 'child_process',
    'fs.', 'net.', 'http.', 'https.', '__proto__',
    'constructor.', 'globalThis', 'Function(',
    'eval(', 'setTimeout(', 'setInterval(',
    'execSync', 'spawnSync', 'exec(',
];

/**
 * Check if an expression contains dangerous patterns.
 */
export function findDangerousPattern(input: string): string | null {
    for (const pattern of DANGEROUS_PATTERNS) {
        if (input.includes(pattern)) return pattern;
    }
    return null;
}

/**
 * Validate that a math expression only contains safe characters.
 */
export function isValidMathExpression(expr: string): boolean {
    const stripped = expr.replace(/\b(sin|cos|tan|abs|sqrt|pow|log|ceil|floor|round|min|max|PI|E)\b/gi, '');
    // Allow empty result (happens when expression is just "PI" or "E")
    if (stripped.trim() === '') return true;
    return /^[0-9+\-*/().,%^e\s]+$/.test(stripped);
}

// ═══════════════════════════════════════════════════════════════
// STRING SANITIZATION
// ═══════════════════════════════════════════════════════════════

/**
 * Sanitize a string for safe inclusion in AppleScript.
 */
export function sanitizeForAppleScript(input: string): string {
    return input
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/'/g, "\\'")
        .replace(/`/g, '\\`')
        .replace(/\$/g, '\\$')
        .replace(/\n/g, ' ')
        .replace(/\r/g, '')
        .slice(0, 256);
}

/**
 * Strip ANSI escape codes from a string.
 */
export function stripAnsi(input: string): string {
    // eslint-disable-next-line no-control-regex
    return input.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Truncate a string to maxLen, adding ellipsis if truncated.
 */
export function truncate(input: string, maxLen: number): string {
    if (input.length <= maxLen) return input;
    return input.slice(0, maxLen - 3) + '...';
}

// ═══════════════════════════════════════════════════════════════
// URL SANITIZATION
// ═══════════════════════════════════════════════════════════════

/**
 * Validate that a URL uses an allowed protocol.
 */
export function isValidHttpUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Sanitize a URL — block dangerous protocols.
 */
export function sanitizeUrl(url: string): string | null {
    try {
        const parsed = new URL(url);
        const blocked = ['javascript:', 'data:', 'file:', 'vbscript:'];
        if (blocked.includes(parsed.protocol)) return null;
        return parsed.href;
    } catch {
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════
// LEGACY-COMPATIBLE FUNCTIONS (used by phase12 tests)
// ═══════════════════════════════════════════════════════════════

/**
 * Sanitize text — strip HTML tags, path traversal, null bytes, and truncate.
 */
export function sanitizeText(
    input: string,
    options?: { allowTags?: string[]; maxLength?: number },
): string {
    let result = input;

    // Strip HTML tags (optionally keep allowed tags)
    if (options?.allowTags?.length) {
        const allowPattern = options.allowTags.map(t => `</?${t}>`).join('|');
        const allowRegex = new RegExp(allowPattern, 'gi');
        const allowed: string[] = [];
        result.replace(allowRegex, (m) => { allowed.push(m); return m; });
        // Remove all tags except allowed
        result = result.replace(/<\/?[^>]+>/g, (m) => {
            for (const tag of options.allowTags!) {
                if (new RegExp(`^</?${tag}>$`, 'i').test(m)) return m;
            }
            return '';
        });
    } else {
        result = result.replace(/<\/?[^>]+>/g, '');
    }

    // Remove path traversal
    result = result.replace(/\.\.\//g, '');

    // Remove null bytes
    result = result.replace(/\0/g, '');

    // Truncate
    if (options?.maxLength && result.length > options.maxLength) {
        result = result.slice(0, options.maxLength);
    }

    return result;
}

/**
 * Sanitize a filename — replace dangerous chars with underscores.
 */
export function sanitizeFilename(input: string): string {
    return input
        .replace(/\.\.\//g, '__')
        .replace(/\.\.\\/g, '__')
        .replace(/\//g, '_')
        .replace(/\\/g, '_')
        .replace(/[<>:"|?*]/g, '_');
}

/**
 * Detect potential injection attacks in text.
 */
export function detectInjection(input: string): { safe: boolean; threats?: string[]; type?: string; pattern?: string } {
    const threats: string[] = [];

    // SQL injection
    if (/('|--|;)\s*(OR|AND|DROP|SELECT|INSERT|DELETE|UPDATE|UNION)/i.test(input)) {
        threats.push('sql-injection');
    }

    // XSS
    if (/<script\b/i.test(input) || /on\w+\s*=/i.test(input)) {
        threats.push('xss');
    }

    // Shell/command injection
    if (/[;&|`$]/.test(input) && /\b(rm|cat|echo|wget|curl|bash|sh)\b/.test(input)) {
        threats.push('command-injection');
    }

    if (threats.length > 0) {
        return { safe: false, threats, type: threats[0], pattern: input.slice(0, 50) };
    }

    return { safe: true };
}

/**
 * Recursively sanitize all string values in an object.
 */
export function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            result[key] = sanitizeText(value);
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            result[key] = sanitizeObject(value as Record<string, unknown>);
        } else {
            result[key] = value;
        }
    }
    return result;
}

