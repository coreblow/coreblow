/**
 * CoreBlow — Query Parser
 *
 * Parses search query strings into structured queries
 * with operators, phrases, field filters, and boolean logic.
 */

/** Query token */
export type QueryToken =
    | { type: 'term'; value: string }
    | { type: 'phrase'; value: string }
    | { type: 'field'; field: string; value: string }
    | { type: 'not'; value: string }
    | { type: 'operator'; value: 'AND' | 'OR' };

/** Parsed query */
export interface ParsedQuery {
    tokens: QueryToken[];
    raw: string;
    terms: string[];
    phrases: string[];
    filters: Array<{ field: string; value: string }>;
    negations: string[];
}

/**
 * CoreBlow Query Parser
 */
export class QueryParser {
    /**
     * Parse a query string.
     */
    parse(query: string): ParsedQuery {
        const tokens: QueryToken[] = [];
        const terms: string[] = [];
        const phrases: string[] = [];
        const filters: Array<{ field: string; value: string }> = [];
        const negations: string[] = [];

        let i = 0;
        while (i < query.length) {
            // Skip whitespace
            if (query[i] === ' ') { i++; continue; }

            // Quoted phrase
            if (query[i] === '"') {
                const end = query.indexOf('"', i + 1);
                if (end !== -1) {
                    const phrase = query.slice(i + 1, end);
                    tokens.push({ type: 'phrase', value: phrase });
                    phrases.push(phrase);
                    i = end + 1;
                    continue;
                }
            }

            // Negation
            if (query[i] === '-' && i + 1 < query.length && query[i + 1] !== ' ') {
                const end = query.indexOf(' ', i + 1);
                const term = query.slice(i + 1, end === -1 ? query.length : end);
                tokens.push({ type: 'not', value: term });
                negations.push(term);
                i = (end === -1 ? query.length : end);
                continue;
            }

            // Extract word
            const end = query.indexOf(' ', i);
            const word = query.slice(i, end === -1 ? query.length : end);
            i = (end === -1 ? query.length : end);

            // Boolean operators
            if (word === 'AND' || word === 'OR') {
                tokens.push({ type: 'operator', value: word as 'AND' | 'OR' });
                continue;
            }

            // Field filter (field:value)
            const colonIdx = word.indexOf(':');
            if (colonIdx > 0) {
                const field = word.slice(0, colonIdx);
                const value = word.slice(colonIdx + 1);
                tokens.push({ type: 'field', field, value });
                filters.push({ field, value });
                continue;
            }

            // Regular term
            tokens.push({ type: 'term', value: word });
            terms.push(word);
        }

        return { tokens, raw: query, terms, phrases, filters, negations };
    }

    /**
     * Stringify back to query string.
     */
    stringify(parsed: ParsedQuery): string {
        return parsed.tokens.map((t) => {
            switch (t.type) {
                case 'term': return t.value;
                case 'phrase': return `"${t.value}"`;
                case 'field': return `${t.field}:${t.value}`;
                case 'not': return `-${t.value}`;
                case 'operator': return t.value;
            }
        }).join(' ');
    }
}
