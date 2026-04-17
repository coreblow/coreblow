/**
 * auto-reply/reply/directive-parser.ts
 * Parse inline directives from message text.
 * Follows CoreBlow's directive-parsing.ts pattern.
 */

export type DirectiveType = 'model' | 'temperature' | 'style' | 'compact' | 'system' | 'max_tokens' | 'persona' | 'reset';

export interface ParsedDirective {
    type: DirectiveType;
    value: string;
    raw: string;
    position: { start: number; end: number };
}

const DIRECTIVE_PATTERNS: Array<{ type: DirectiveType; regex: RegExp }> = [
    { type: 'model', regex: /@model\s+(\S+)/i },
    { type: 'temperature', regex: /@temp(?:erature)?\s+([\d.]+)/i },
    { type: 'style', regex: /@style\s+(\S+)/i },
    { type: 'compact', regex: /@compact\s+(on|off)/i },
    { type: 'system', regex: /@system\s+"([^"]+)"/i },
    { type: 'max_tokens', regex: /@max[_-]?tokens\s+(\d+)/i },
    { type: 'persona', regex: /@persona\s+(\S+)/i },
    { type: 'reset', regex: /@reset/i },
];

/** Parse all directives from message text. */
export function parseDirectives(text: string): ParsedDirective[] {
    const directives: ParsedDirective[] = [];

    for (const { type, regex } of DIRECTIVE_PATTERNS) {
        const match = regex.exec(text);
        if (match) {
            directives.push({
                type,
                value: match[1] ?? '',
                raw: match[0],
                position: { start: match.index, end: match.index + match[0].length },
            });
        }
    }

    return directives;
}

/** Strip directives from message text, returning clean content. */
export function stripDirectives(text: string): string {
    let clean = text;
    for (const { regex } of DIRECTIVE_PATTERNS) {
        clean = clean.replace(regex, '');
    }
    return clean.replace(/\s{2,}/g, ' ').trim();
}

/** Check if a message contains any directives. */
export function hasDirectives(text: string): boolean {
    return DIRECTIVE_PATTERNS.some(({ regex }) => regex.test(text));
}

/** Parse slash-style directives: /compact on, /model gpt-4o */
export function parseSlashDirectives(text: string): ParsedDirective[] {
    const directives: ParsedDirective[] = [];
    const slashPatterns: Array<{ type: DirectiveType; regex: RegExp }> = [
        { type: 'model', regex: /^\/model\s+(\S+)/i },
        { type: 'compact', regex: /^\/compact\s+(on|off)/i },
        { type: 'temperature', regex: /^\/temp(?:erature)?\s+([\d.]+)/i },
        { type: 'style', regex: /^\/style\s+(\S+)/i },
        { type: 'persona', regex: /^\/persona\s+(\S+)/i },
        { type: 'reset', regex: /^\/reset$/i },
    ];

    for (const { type, regex } of slashPatterns) {
        const match = regex.exec(text);
        if (match) {
            directives.push({
                type, value: match[1] ?? '', raw: match[0],
                position: { start: 0, end: match[0].length },
            });
        }
    }
    return directives;
}
