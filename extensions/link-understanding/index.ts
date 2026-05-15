import { defineExtension } from "coreblow/plugin-sdk/extension";
export default defineExtension({
    meta: { name: 'link-understanding', version: '1.0.0', description: 'URL preview, page summarization, metadata extraction', tags: ['intelligence', 'web'] },
    hooks: {
        async onMessage(msg) {
            // Detect URLs in messages and auto-extract metadata + summary
        },
    },
    tools: [{
        name: 'link_preview',
        description: 'Extract metadata, summary, and preview from URLs',
        parameters: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'URL to preview' },
                mode: { type: 'string', enum: ['preview', 'summarize', 'extract'], default: 'preview' },
            },
            required: ['url'],
        },
        async execute(args) {
            const url = typeof args.url === "string" ? args.url : "";
            if (!url) {
                return "Error: URL is required";
            }
            try {
                const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'CoreBlow/1.0' } });
                const html = await res.text();
                const titleMatch = html.match(/<title>(.*?)<\/title>/i);
                const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
                return JSON.stringify({
                    url,
                    title: titleMatch?.[1] || 'No title',
                    description: descMatch?.[1] || 'No description',
                    statusCode: res.status,
                    contentType: res.headers.get('content-type'),
                }, null, 2);
            } catch (err) {
                return `Error: ${err instanceof Error ? err.message : String(err)}`;
            }
        },
    }],
    async init(ctx) { ctx.logger.info('Link Understanding extension initialized'); },
});
