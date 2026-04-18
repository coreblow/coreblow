// Stub for markdown-it — used by src/markdown/ir.ts
// Provides a minimal API so tests that don't actually parse markdown can pass.

class MarkdownIt {
  constructor(_opts?: unknown) {}
  parse(src: string, _env?: unknown) {
    return [{ type: 'paragraph_open', tag: 'p', nesting: 1, children: null, content: '', map: [0, 1] },
            { type: 'inline', tag: '', nesting: 0, children: [], content: src, map: [0, 1] },
            { type: 'paragraph_close', tag: 'p', nesting: -1, children: null, content: '', map: null }];
  }
  render(src: string) { return `<p>${src}</p>\n`; }
  use() { return this; }
  disable() { return this; }
  enable() { return this; }
}

export default MarkdownIt;
module.exports = MarkdownIt;
module.exports.default = MarkdownIt;
