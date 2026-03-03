import { marked } from "marked";
import DOMPurify from "dompurify";

export function renderMarkdown(source: string): string {
   if (!source) return "";
   try {
       const html = marked.parse(source, { breaks: true, gfm: true }) as string;
       return DOMPurify.sanitize(html, {
          USE_PROFILES: { html: true },
          FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input"],
       });
   } catch {
       return DOMPurify.sanitize(source);
   }
}
