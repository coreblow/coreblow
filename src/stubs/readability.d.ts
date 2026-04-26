// Type declarations for @mozilla/readability
// Not installed as a dependency — used via dynamic import with fallback
declare module '@mozilla/readability' {
  export class Readability {
    constructor(doc: Document, options?: Record<string, unknown>);
    parse(): { title: string; content: string; textContent: string; length: number; excerpt: string; byline: string; dir: string; siteName: string; lang: string } | null;
  }
  export function isProbablyReaderable(doc: Document, options?: Record<string, unknown>): boolean;
}
