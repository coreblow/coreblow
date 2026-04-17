/**
 * markdown/parser.ts
 */
export function parseMarkdown(md: string) { return md.split('\n').map(l => { if (l.startsWith('#')) return {type: 'heading', content: l.replace(/^#+\s*/, '')}; return {type: 'paragraph', content: l}; }); }
