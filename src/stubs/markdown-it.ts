// Stub for markdown-it — used by src/markdown/ and extensions/matrix/
// Provides a minimal API so tests that transitively import markdown-it can pass.

class MarkdownIt {
  utils = {
    escapeHtml: (str: string) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    unescapeAll: (str: string) => str,
    lib: {},
  };

  renderer = {
    rules: {} as Record<string, unknown>,
    render: (tokens: any[], _options: any, _env: any) =>
      tokens.map((t: any) => t.content || '').join(''),
    renderToken: (_tokens: any[], _idx: number, _options: any) => '',
  };

  constructor(_opts?: unknown) {}

  parse(src: string, _env?: unknown) {
    return [
      { type: 'paragraph_open', tag: 'p', nesting: 1, children: null, content: '', map: [0, 1] },
      { type: 'inline', tag: '', nesting: 0, children: [], content: src, map: [0, 1] },
      { type: 'paragraph_close', tag: 'p', nesting: -1, children: null, content: '', map: null },
    ];
  }

  render(src: string) { return `<p>${src}</p>\n`; }
  renderInline(src: string) { return src; }
  use() { return this; }
  disable() { return this; }
  enable() { return this; }
}

export default MarkdownIt;
module.exports = MarkdownIt;
module.exports.default = MarkdownIt;
