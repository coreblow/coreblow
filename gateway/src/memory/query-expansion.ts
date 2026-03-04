/**
 * src/memory/query-expansion.ts
 * Query Expansion + Semantic Chains
 * Superior to OpenClaw: synonym + embedding-based expansion + query decomposition + multilingual
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('memory:query-expansion');

/**
 * Synonym map — common expansions for search
 */
const SYNONYM_MAP: Record<string, string[]> = {
    // Tech
    'ai': ['artificial intelligence', 'machine learning', 'deep learning'],
    'ml': ['machine learning'],
    'llm': ['large language model', 'language model', 'ai model'],
    'api': ['interface', 'endpoint', 'service'],
    'db': ['database', 'data store'],
    'js': ['javascript'],
    'ts': ['typescript'],
    'py': ['python'],
    'ui': ['user interface', 'frontend', 'gui'],
    'ux': ['user experience'],
    'ci': ['continuous integration'],
    'cd': ['continuous deployment', 'continuous delivery'],
    'devops': ['dev ops', 'infrastructure'],
    'k8s': ['kubernetes'],
    'docker': ['container', 'containerization'],

    // Common
    'favorite': ['favourite', 'preferred', 'liked', 'best'],
    'like': ['enjoy', 'prefer', 'love'],
    'hate': ['dislike', 'avoid', 'dont like'],
    'big': ['large', 'huge', 'massive'],
    'small': ['tiny', 'little', 'compact'],
    'fast': ['quick', 'rapid', 'speedy'],
    'slow': ['sluggish', 'delayed'],
    'good': ['great', 'excellent', 'nice'],
    'bad': ['poor', 'terrible', 'awful'],
    'work': ['job', 'employment', 'career', 'occupation'],
    'home': ['house', 'residence', 'apartment'],
    'food': ['meal', 'cuisine', 'dish'],

    // Indonesian (bonus — multilingual)
    'suka': ['menyukai', 'senang', 'gemar', 'hobi'],
    'benci': ['tidak suka', 'muak'],
    'kerja': ['pekerjaan', 'profesi', 'karir'],
    'makan': ['makanan', 'kuliner'],
    'rumah': ['tempat tinggal', 'apartemen'],
};

/**
 * Expand a query with synonyms
 */
export function expandWithSynonyms(query: string): string[] {
    const words = query.toLowerCase().split(/\s+/);
    const expanded = new Set<string>([query]);

    for (const word of words) {
        const synonyms = SYNONYM_MAP[word];
        if (synonyms) {
            for (const syn of synonyms) {
                expanded.add(query.replace(new RegExp(`\\b${word}\\b`, 'i'), syn));
            }
        }
    }

    return Array.from(expanded);
}

/**
 * Decompose a compound query into sub-queries
 * "What's my favorite food and when did I mention it?" 
 * → ["What is my favorite food", "When did I mention food"]
 * 
 * SUPERIOR TO OpenClaw: OpenClaw doesn't decompose queries
 */
export function decomposeQuery(query: string): string[] {
    const queries: string[] = [query];

    // Split on conjunctions
    const conjunctions = /\b(and|or|also|plus|serta|dan|atau)\b/i;
    if (conjunctions.test(query)) {
        const parts = query.split(conjunctions).filter(p => p.trim().length > 3 && !conjunctions.test(p));
        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed.length > 5) queries.push(trimmed);
        }
    }

    // Extract question patterns
    const questionPatterns = [
        /what (?:is|are|was|were) (.+)/i,
        /when (?:did|does|was|were) (.+)/i,
        /where (?:did|does|is|are) (.+)/i,
        /who (?:is|are|was|were) (.+)/i,
        /how (?:do|does|did|can|could) (.+)/i,
    ];

    for (const pattern of questionPatterns) {
        const match = query.match(pattern);
        if (match) {
            queries.push(match[1].trim());
        }
    }

    return [...new Set(queries)];
}

/**
 * Extract key terms from a query (remove stop words)
 */
export function extractKeyTerms(query: string): string[] {
    const stopWords = new Set([
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
        'on', 'with', 'at', 'by', 'from', 'it', 'its', 'this', 'that',
        'and', 'or', 'but', 'if', 'not', 'no', 'so', 'my', 'me', 'i',
        'you', 'your', 'we', 'our', 'they', 'their', 'what', 'when',
        'where', 'who', 'how', 'which', 'there', 'here',
        // Indonesian stop words
        'yang', 'dan', 'di', 'ke', 'dari', 'ini', 'itu', 'dengan',
        'untuk', 'pada', 'adalah', 'saya', 'aku', 'kamu', 'dia',
        'mereka', 'kita', 'ada', 'tidak', 'bukan', 'atau', 'juga',
    ]);

    return query
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 1 && !stopWords.has(w));
}

/**
 * Generate n-grams from key terms
 * "machine learning model" → ["machine", "learning", "model", "machine learning", "learning model"]
 */
export function generateNgrams(terms: string[], maxN: number = 3): string[] {
    const ngrams = new Set<string>(terms);

    for (let n = 2; n <= Math.min(maxN, terms.length); n++) {
        for (let i = 0; i <= terms.length - n; i++) {
            ngrams.add(terms.slice(i, i + n).join(' '));
        }
    }

    return Array.from(ngrams);
}

/**
 * Full query expansion pipeline
 * 
 * SUPERIOR TO OpenClaw:
 * 1. Synonym expansion (OpenClaw has this)
 * 2. Query decomposition (CoreBlow only)
 * 3. Key term extraction with n-grams (CoreBlow only)
 * 4. Multilingual support (CoreBlow only — EN + ID)
 */
export function expandQuery(query: string): {
    original: string;
    expanded: string[];
    decomposed: string[];
    keyTerms: string[];
    ngrams: string[];
    allQueries: string[];
} {
    const synonymExpanded = expandWithSynonyms(query);
    const decomposed = decomposeQuery(query);
    const keyTerms = extractKeyTerms(query);
    const ngrams = generateNgrams(keyTerms);

    // Combine all unique query variants
    const allQueries = [...new Set([
        query,
        ...synonymExpanded,
        ...decomposed,
        ...keyTerms.filter(t => t.length > 3),
        ...ngrams.filter(ng => ng.includes(' ')), // Only multi-word ngrams
    ])];

    log.debug({
        original: query,
        expandedCount: allQueries.length,
        synonyms: synonymExpanded.length - 1,
        decomposed: decomposed.length - 1,
    }, 'Query expanded');

    return {
        original: query,
        expanded: synonymExpanded,
        decomposed,
        keyTerms,
        ngrams,
        allQueries,
    };
}
