/**
 * auto-reply/reply/auto-topic.ts
 * Auto-generate conversation topic labels.
 * Follows CoreBlow's auto-topic-label.ts pattern.
 */

/** Generate a topic label from the first user message. */
export function generateTopicLabel(messages: Array<{ role: string; content: string }>): string {
    const firstUser = messages.find(m => m.role === 'user');
    if (!firstUser) return 'New Conversation';

    const content = firstUser.content.trim();
    if (content.length <= 50) return content;

    // Try to find a natural break point
    const sentenceEnd = content.slice(0, 80).search(/[.!?]\s/);
    if (sentenceEnd > 10) return content.slice(0, sentenceEnd + 1);

    const wordBreak = content.slice(0, 55).lastIndexOf(' ');
    if (wordBreak > 20) return content.slice(0, wordBreak) + '…';

    return content.slice(0, 50) + '…';
}

/** Extract keywords from text for topic categorization. */
export function extractKeywords(text: string, maxKeywords = 5): string[] {
    const stopWords = new Set([
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
        'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about', 'it', 'its',
        'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'you', 'your',
        'he', 'she', 'they', 'them', 'what', 'how', 'when', 'where', 'why',
        'and', 'or', 'but', 'not', 'so', 'if', 'then', 'than', 'no', 'yes',
    ]);

    const words = text.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w));

    // Count frequency
    const freq = new Map<string, number>();
    for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);

    return Array.from(freq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxKeywords)
        .map(([word]) => word);
}

/** Categorize a conversation based on content. */
export function categorizeConversation(messages: Array<{ role: string; content: string }>): string {
    const allText = messages.map(m => m.content).join(' ').toLowerCase();

    const categories: Array<{ name: string; keywords: string[] }> = [
        { name: 'coding', keywords: ['code', 'function', 'error', 'debug', 'bug', 'typescript', 'python', 'javascript', 'api', 'class'] },
        { name: 'writing', keywords: ['write', 'essay', 'article', 'blog', 'story', 'draft', 'edit', 'proofread'] },
        { name: 'analysis', keywords: ['analyze', 'compare', 'evaluate', 'review', 'assess', 'data', 'chart'] },
        { name: 'creative', keywords: ['create', 'design', 'imagine', 'brainstorm', 'idea', 'concept'] },
        { name: 'math', keywords: ['calculate', 'equation', 'formula', 'math', 'number', 'solve'] },
        { name: 'general', keywords: ['explain', 'help', 'question', 'tell', 'know'] },
    ];

    let bestCategory = 'general';
    let bestScore = 0;

    for (const cat of categories) {
        const score = cat.keywords.reduce((sum, kw) => sum + (allText.includes(kw) ? 1 : 0), 0);
        if (score > bestScore) { bestScore = score; bestCategory = cat.name; }
    }

    return bestCategory;
}
