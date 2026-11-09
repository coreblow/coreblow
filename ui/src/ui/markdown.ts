import { Marked } from "marked";
import DOMPurify from "dompurify";

const markedInstance = new Marked({
  breaks: true,
  gfm: true,
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const cleanLang = (lang || "").split(/\s+/)[0] || "code";
      const escapedText = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `
        <div class="code-block" style="margin: 8px 0; border: 1px solid var(--border, #16322C); border-radius: 6px; overflow: hidden; background: #0B1714;">
          <div class="code-header" style="display: flex; justify-content: space-between; align-items: center; padding: 4px 10px; background: rgba(22, 50, 44, 0.4); border-bottom: 1px solid var(--border, #16322C); font-size: 11px; color: var(--muted, #94a3b8); font-family: var(--font-mono, monospace);">
            <span class="code-lang">${cleanLang}</span>
            <button class="code-copy-btn" style="background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: inherit; font-size: 10px; padding: 2px 8px; cursor: pointer;">Copy</button>
          </div>
          <pre style="margin: 0; padding: 10px 12px; overflow-x: auto; font-size: 12px; line-height: 1.45; font-family: var(--font-mono, monospace);"><code>${escapedText}</code></pre>
        </div>
      `;
    },
  },
});

export function renderMarkdown(source: string): string {
  if (!source) return "";
  try {
    const html = markedInstance.parse(source) as string;
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input"],
      ADD_TAGS: ["button"],
      ADD_ATTR: ["style", "class"],
    });
  } catch {
    return DOMPurify.sanitize(source);
  }
}
