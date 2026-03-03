/**
 * CoreBlow — URL Scraper
 *
 * Extracts content from URLs for agent consumption.
 * Supports HTML-to-text conversion, metadata extraction,
 * link discovery, and content caching.
 */

/** Scraped content */
export interface ScrapedContent {
    url: string;
    title: string;
    description?: string;
    text: string;
    links: string[];
    metadata: Record<string, string>;
    wordCount: number;
    scrapedAt: number;
    durationMs: number;
}

/** Scraper options */
export interface ScraperOptions {
    /** Max content length */
    maxLength?: number;
    /** Timeout in ms */
    timeoutMs?: number;
    /** User agent */
    userAgent?: string;
    /** Cache TTL in ms */
    cacheTTL?: number;
}

/**
 * CoreBlow URL Scraper
 */
export class URLScraper {
    private cache = new Map<string, { content: ScrapedContent; expiresAt: number }>();
    private options: Required<ScraperOptions>;
    private history: Array<{ url: string; success: boolean; timestamp: number }> = [];

    constructor(opts?: ScraperOptions) {
        this.options = {
            maxLength: opts?.maxLength ?? 50_000,
            timeoutMs: opts?.timeoutMs ?? 10_000,
            userAgent: opts?.userAgent ?? 'CoreBlow/1.0',
            cacheTTL: opts?.cacheTTL ?? 300_000, // 5 min
        };
    }

    /**
     * Scrape a URL.
     */
    async scrape(url: string): Promise<ScrapedContent | null> {
        // Check cache
        const cached = this.cache.get(url);
        if (cached && Date.now() < cached.expiresAt) return cached.content;

        const start = Date.now();
        try {
            const res = await fetch(url, {
                headers: { 'User-Agent': this.options.userAgent },
                signal: AbortSignal.timeout(this.options.timeoutMs),
            });

            if (!res.ok) {
                this.recordHistory(url, false);
                return null;
            }

            const html = await res.text();
            const content = this.parseHTML(url, html, Date.now() - start);

            // Cache
            this.cache.set(url, { content, expiresAt: Date.now() + this.options.cacheTTL });
            this.recordHistory(url, true);
            return content;
        } catch {
            this.recordHistory(url, false);
            return null;
        }
    }

    /**
     * Parse raw HTML into structured content.
     */
    parseHTML(url: string, html: string, durationMs: number = 0): ScrapedContent {
        const title = this.extractTag(html, 'title') ?? url;
        const description = this.extractMeta(html, 'description');

        // Extract text (strip tags)
        let text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/\s+/g, ' ')
            .trim();

        if (text.length > this.options.maxLength) {
            text = text.slice(0, this.options.maxLength) + '...';
        }

        // Extract links
        const linkMatches = html.match(/href="(https?:\/\/[^"]+)"/g) ?? [];
        const links = linkMatches.map((m) => m.slice(6, -1)).slice(0, 50);

        // Metadata
        const metadata: Record<string, string> = {};
        const ogTitle = this.extractMeta(html, 'og:title');
        const ogImage = this.extractMeta(html, 'og:image');
        if (ogTitle) metadata['og:title'] = ogTitle;
        if (ogImage) metadata['og:image'] = ogImage;
        if (description) metadata['description'] = description;

        return {
            url, title, description: description ?? undefined, text, links, metadata,
            wordCount: text.split(/\s+/).length,
            scrapedAt: Date.now(),
            durationMs,
        };
    }

    /**
     * Get cached content.
     */
    getCached(url: string): ScrapedContent | null {
        const cached = this.cache.get(url);
        if (!cached || Date.now() > cached.expiresAt) return null;
        return cached.content;
    }

    /**
     * Clear cache.
     */
    clearCache(): number {
        const count = this.cache.size;
        this.cache.clear();
        return count;
    }

    /**
     * Get scrape history.
     */
    getHistory(limit?: number): typeof this.history {
        return this.history.slice(-(limit ?? 30));
    }

    // === Private ===

    private extractTag(html: string, tag: string): string | null {
        const m = html.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'));
        return m?.[1]?.trim() ?? null;
    }

    private extractMeta(html: string, name: string): string | null {
        const m = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'))
            ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, 'i'));
        return m?.[1] ?? null;
    }

    private recordHistory(url: string, success: boolean): void {
        this.history.push({ url, success, timestamp: Date.now() });
        if (this.history.length > 500) this.history = this.history.slice(-500);
    }
}
