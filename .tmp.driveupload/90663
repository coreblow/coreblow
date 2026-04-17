/**
 * CoreBlow Infra — Warning Filter
 *
 * Suppresses noisy Node.js process warnings (ExperimentalWarning,
 * DeprecationWarning) that clutter the terminal. Configurable
 * pattern-based filtering with optional logging of suppressed warnings.
 */

/** Warning filter rule */
export interface WarningFilter {
    /** Warning type to match (e.g., "ExperimentalWarning") */
    type?: string;
    /** Pattern to match in the warning message */
    messagePattern?: RegExp | string;
    /** Whether to silently suppress or log the suppression */
    silent?: boolean;
}

/** Default filters for common Node.js noise */
const DEFAULT_FILTERS: WarningFilter[] = [
    { type: 'ExperimentalWarning', silent: true },
    { type: 'DeprecationWarning', messagePattern: /Buffer\(\)/, silent: true },
    { type: 'DeprecationWarning', messagePattern: /punycode/, silent: true },
    { messagePattern: /fetch.*experimental/i, silent: true },
];

let installed = false;
let customFilters: WarningFilter[] = [];
let suppressedCount = 0;

/**
 * Install the global warning filter.
 */
export function installWarningFilter(extraFilters?: WarningFilter[]): void {
    if (installed) return;

    if (extraFilters) {
        customFilters = extraFilters;
    }

    const originalEmit = process.emit.bind(process);

    // @ts-ignore — process.emit override
    process.emit = function (event: string, ...args: unknown[]) {
        if (event === 'warning') {
            const warning = args[0] as { name?: string; message?: string } | undefined;
            if (warning && shouldSuppress(warning)) {
                suppressedCount++;
                return false;
            }
        }
        return (originalEmit as Function).call(process, event, ...args) as boolean;
    } as typeof process.emit;

    installed = true;
}

/**
 * Get count of suppressed warnings.
 */
export function getSuppressedCount(): number {
    return suppressedCount;
}

/**
 * Add a custom filter at runtime.
 */
export function addFilter(filter: WarningFilter): void {
    customFilters.push(filter);
}

function shouldSuppress(warning: { name?: string; message?: string }): boolean {
    const allFilters = [...DEFAULT_FILTERS, ...customFilters];

    for (const filter of allFilters) {
        if (filter.type && warning.name !== filter.type) continue;

        if (filter.messagePattern) {
            const pattern = filter.messagePattern instanceof RegExp
                ? filter.messagePattern
                : new RegExp(filter.messagePattern, 'i');
            if (!pattern.test(warning.message ?? '')) continue;
        }

        return true;
    }

    return false;
}
