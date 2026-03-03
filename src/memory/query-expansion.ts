/**
 * CoreBlow — Query Expansion
 * Expands queries with synonyms, decomposition, key term extraction, and n-grams.
 */

const SYNONYMS: Record<string, string[]> = {
    like: ['enjoy', 'prefer', 'love', 'fond of'],
    suka: ['menyukai', 'gemar', 'senang'],
    makan: ['santap', 'konsumsi', 'nikmati'],
    favorite: ['preferred', 'best', 'top'],
    good: ['great', 'excellent', 'nice'],
    bad: ['terrible', 'awful', 'poor'],
    fast: ['quick', 'rapid', 'speedy'],
    big: ['large', 'huge', 'enormous'],
    ai: ['artificial intelligence', 'machine learning'],
    ts: ['typescript'],
    js: ['javascript'],
    ml: ['machine learning'],
    db: ['database'],
    api: ['application programming interface'],
};

const STOP_WORDS_EN = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for', 'on', 'with', 'at',
    'by', 'from', 'it', 'its', 'my', 'your', 'what', 'which', 'who', 'whom', 'this',
    'that', 'these', 'those', 'i', 'me', 'we', 'you', 'he', 'she', 'they', 'very']);

const STOP_WORDS_ID = new Set(['yang', 'dan', 'di', 'ke', 'dari', 'ini', 'itu', 'dengan',
    'untuk', 'pada', 'adalah', 'tidak', 'akan', 'saya', 'dia', 'mereka', 'kami',
    'kita', 'sudah', 'belum', 'juga', 'atau', 'ada', 'bisa', 'oleh', 'seorang',
    'kalau', 'jika', 'maka', 'tapi', 'tetapi', 'agar', 'supaya', 'harus', 'ingin']);

const ALL_STOP_WORDS = new Set([...STOP_WORDS_EN, ...STOP_WORDS_ID]);

export function expandWithSynonyms(query: string): string[] {
    const words = query.toLowerCase().split(/\s+/);
    const expanded = [query];
    for (const word of words) {
        const syns = SYNONYMS[word];
        if (syns) {
            for (const syn of syns) {
                expanded.push(query.replace(new RegExp(`\\b${word}\\b`, 'gi'), syn));
            }
        }
    }
    return [...new Set(expanded)];
}

export function decomposeQuery(query: string): string[] {
    // Split on conjunctions (English and Indonesian)
    let parts = query.split(/\s+(?:and|or|dan|atau)\s+|,\s*/i).map(s => s.trim()).filter(Boolean);

    // Also try to extract question patterns
    const qMatch = query.match(/^(?:what|who|when|where|how|why|which)\s+(?:is|are|was|were)\s+(.+)/i);
    if (qMatch && qMatch[1]) {
        parts = [...parts, qMatch[1].trim()];
    }

    return parts.length > 1 ? [...new Set(parts)] : [query];
}

export function extractKeyTerms(query: string): string[] {
    return query.toLowerCase().split(/\s+/)
        .map(w => w.replace(/[^\w]/g, ''))
        .filter(w => w.length > 1 && !ALL_STOP_WORDS.has(w));
}

export function generateNgrams(words: string[], maxN = 2): string[] {
    const ngrams: string[] = [];
    for (let n = 1; n <= maxN; n++) {
        for (let i = 0; i <= words.length - n; i++) {
            ngrams.push(words.slice(i, i + n).join(' '));
        }
    }
    return ngrams;
}

export function expandQuery(query: string) {
    const expanded = expandWithSynonyms(query);
    const decomposed = decomposeQuery(query);
    const keyTerms = extractKeyTerms(query);
    const ngrams = generateNgrams(keyTerms);
    const allQueries = [...new Set([...expanded, ...decomposed, ...ngrams])];
    return { original: query, expanded, decomposed, keyTerms, allQueries };
}
