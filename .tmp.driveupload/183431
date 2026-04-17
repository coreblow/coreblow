# @create-markdown/preview

Framework-agnostic HTML rendering for @create-markdown with syntax highlighting (Shiki) and diagram support (Mermaid).

## Installation

```bash
# Using pnpm
pnpm add @create-markdown/preview

# Using npm
npm install @create-markdown/preview

# Optional: Install plugins
pnpm add shiki mermaid
```

## Quick Start

### Basic HTML Rendering

```typescript
import { markdownToHTML } from '@create-markdown/preview';

const html = markdownToHTML(`
# Hello World

This is **bold** and *italic* text.
`);

document.getElementById('preview').innerHTML = html;
```

### With Syntax Highlighting (Shiki)

```typescript
import { renderAsync, shikiPlugin } from '@create-markdown/preview';
import { parse } from '@create-markdown/core';

const blocks = parse(`
\`\`\`typescript
const greeting = "Hello, World!";
console.log(greeting);
\`\`\`
`);

const html = await renderAsync(blocks, {
  plugins: [shikiPlugin({ theme: 'github-dark' })],
});
```

### With Mermaid Diagrams

```typescript
import { renderAsync, mermaidPlugin } from '@create-markdown/preview';
import { parse } from '@create-markdown/core';

const blocks = parse(`
\`\`\`mermaid
flowchart LR
  A[Start] --> B[Process]
  B --> C[End]
\`\`\`
`);

const html = await renderAsync(blocks, {
  plugins: [mermaidPlugin({ theme: 'default' })],
});
```

### Web Component

```html
<script type="module">
  import { registerPreviewElement } from '@create-markdown/preview';
  registerPreviewElement();
</script>

<markdown-preview theme="github">
# Hello World

This is rendered as HTML automatically!
</markdown-preview>
```

With plugins:

```typescript
import { registerPreviewElement, shikiPlugin, mermaidPlugin } from '@create-markdown/preview';

registerPreviewElement({
  plugins: [
    shikiPlugin(),
    mermaidPlugin(),
  ],
});
```

## API

### `blocksToHTML(blocks, options?)`

Converts blocks to HTML string synchronously.

### `markdownToHTML(markdown, options?)`

Converts markdown string to HTML.

### `renderAsync(blocks, options?)`

Async version that initializes plugins before rendering.

### Plugins

- `shikiPlugin(options?)` - Syntax highlighting with Shiki
- `mermaidPlugin(options?)` - Mermaid diagram rendering

### Themes

CSS themes are available at:

- `@create-markdown/preview/themes/github.css`
- `@create-markdown/preview/themes/github-dark.css`
- `@create-markdown/preview/themes/minimal.css`

## Options

```typescript
interface PreviewOptions {
  classPrefix?: string;       // CSS class prefix (default: 'cm-')
  theme?: string;             // Theme name
  linkTarget?: '_blank' | '_self';
  sanitize?: boolean;         // Sanitize HTML output
  plugins?: PreviewPlugin[];  // Plugins for enhanced rendering
}
```

## License

MIT
