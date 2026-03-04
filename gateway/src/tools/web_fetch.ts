/**
 * src/tools/web_fetch.ts
 * Fetch a URL and extract text content
 */

import type { ToolHandler } from './types.js';

export const webFetchTool: ToolHandler = {
    name: 'web_fetch',
    description: 'Fetch a URL and extract its text content. Useful for reading web pages, documentation, APIs, etc.',
    parameters: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'URL to fetch',
            },
            extract: {
                type: 'string',
                enum: ['text', 'html', 'json'],
                description: 'What to extract: text (default), html (raw), or json',
            },
        },
        required: ['url'],
    },

    async execute(args: Record<string, any>): Promise<string> {
        const { url, extract = 'text' } = args;

        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'CoreBlow-Gateway/1.0',
                    Accept: 'text/html,application/xhtml+xml,application/json,text/plain;q=0.9',
                },
                signal: AbortSignal.timeout(15000),
            });

            if (!res.ok) {
                return `Error: HTTP ${res.status} ${res.statusText}`;
            }

            if (extract === 'json') {
                const json = await res.json();
                return JSON.stringify(json, null, 2);
            }

            const html = await res.text();

            if (extract === 'html') {
                return html.length > 20000 ? html.slice(0, 20000) + '\n... (truncated)' : html;
            }

            // Extract text from HTML (basic)
            const text = htmlToText(html);
            return text.length > 15000 ? text.slice(0, 15000) + '\n... (truncated)' : text;
        } catch (err: any) {
            return `Error fetching ${url}: ${err.message}`;
        }
    },
};

/**
 * Basic HTML to text conversion
 */
function htmlToText(html: string): string {
    return html
        // Remove script and style
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        // Remove comments
        .replace(/<!--[\s\S]*?-->/g, '')
        // Headers
        .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n## $1\n')
        // Paragraphs and divs
        .replace(/<\/?(p|div|br|hr|li|tr)[^>]*>/gi, '\n')
        // Links
        .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
        // Remove remaining tags
        .replace(/<[^>]+>/g, '')
        // Decode entities
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        // Clean whitespace
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
