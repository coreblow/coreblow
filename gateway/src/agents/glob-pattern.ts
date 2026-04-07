/**
 * agents/glob-pattern.ts
 * Minimatch-style glob matching for tool/file policies.
 */
export function globMatch(pattern: string, text: string): boolean {
    const regex = globToRegexp(pattern);
    return regex.test(text);
}
export function globToRegexp(pattern: string): RegExp {
    let re = '^';
    for (let i = 0; i < pattern.length; i++) {
        const c = pattern[i];
        if (c === '*') { if (pattern[i + 1] === '*') { re += '.*'; i++; if (pattern[i + 1] === '/') i++; } else re += '[^/]*'; }
        else if (c === '?') re += '[^/]';
        else if (c === '[') { const end = pattern.indexOf(']', i); if (end >= 0) { re += pattern.slice(i, end + 1); i = end; } else re += '\\['; }
        else if ('.+^${}()|\\'.includes(c)) re += `\\${c}`;
        else re += c;
    }
    return new RegExp(re + '$');
}
export function globMatchAny(patterns: string[], text: string): boolean { return patterns.some((p) => globMatch(p, text)); }
export function filterByGlob<T>(items: T[], patterns: string[], keyFn: (item: T) => string): T[] { return items.filter((item) => globMatchAny(patterns, keyFn(item))); }
