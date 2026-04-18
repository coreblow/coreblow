/**
 * markdown/ir.ts
 * Markdown Intermediate Representation.
 * Ported from CoreBlow src/markdown/ir.ts.
 */

export type MarkdownStyle = 'bold' | 'italic' | 'strikethrough' | 'code' | 'code_block' | 'spoiler' | 'blockquote';

export interface MarkdownStyleSpan {
    start: number;
    end: number;
    style: MarkdownStyle;
}

export interface MarkdownLinkSpan {
    start: number;
    end: number;
    href: string;
}

export interface MarkdownIR {
    text: string;
    styles: MarkdownStyleSpan[];
    links: MarkdownLinkSpan[];
}

interface OpenStyle {
    style: MarkdownStyle;
    start: number;
}

/**
 * Parse markdown text into an intermediate representation.
 */
export function parseMarkdownToIR(markdown: string): MarkdownIR {
    const styles: MarkdownStyleSpan[] = [];
    const links: MarkdownLinkSpan[] = [];
    let text = '';
    let i = 0;

    const openStyles: OpenStyle[] = [];

    while (i < markdown.length) {
        // Bold **text**
        if (markdown[i] === '*' && markdown[i + 1] === '*') {
            const existing = openStyles.findIndex((s) => s.style === 'bold');
            if (existing >= 0) {
                styles.push({ start: openStyles[existing].start, end: text.length, style: 'bold' });
                openStyles.splice(existing, 1);
            } else {
                openStyles.push({ style: 'bold', start: text.length });
            }
            i += 2; continue;
        }

        // Italic *text*
        if (markdown[i] === '*' && markdown[i + 1] !== '*') {
            const existing = openStyles.findIndex((s) => s.style === 'italic');
            if (existing >= 0) {
                styles.push({ start: openStyles[existing].start, end: text.length, style: 'italic' });
                openStyles.splice(existing, 1);
            } else {
                openStyles.push({ style: 'italic', start: text.length });
            }
            i += 1; continue;
        }

        // Strikethrough ~~text~~
        if (markdown[i] === '~' && markdown[i + 1] === '~') {
            const existing = openStyles.findIndex((s) => s.style === 'strikethrough');
            if (existing >= 0) {
                styles.push({ start: openStyles[existing].start, end: text.length, style: 'strikethrough' });
                openStyles.splice(existing, 1);
            } else {
                openStyles.push({ style: 'strikethrough', start: text.length });
            }
            i += 2; continue;
        }

        // Inline code `text`
        if (markdown[i] === '`' && markdown[i + 1] !== '`') {
            const closeIdx = markdown.indexOf('`', i + 1);
            if (closeIdx > i) {
                const code = markdown.slice(i + 1, closeIdx);
                const start = text.length;
                text += code;
                styles.push({ start, end: text.length, style: 'code' });
                i = closeIdx + 1; continue;
            }
        }

        // Links [text](url)
        if (markdown[i] === '[') {
            const closeText = markdown.indexOf(']', i + 1);
            if (closeText > i && markdown[closeText + 1] === '(') {
                const closeUrl = markdown.indexOf(')', closeText + 2);
                if (closeUrl > closeText) {
                    const linkText = markdown.slice(i + 1, closeText);
                    const href = markdown.slice(closeText + 2, closeUrl);
                    const start = text.length;
                    text += linkText;
                    links.push({ start, end: text.length, href });
                    i = closeUrl + 1; continue;
                }
            }
        }

        text += markdown[i];
        i++;
    }

    return { text, styles, links };
}

/**
 * Create an empty IR.
 */
export function emptyIR(): MarkdownIR {
    return { text: '', styles: [], links: [] };
}

/**
 * Merge multiple IRs.
 */
export function mergeIR(parts: MarkdownIR[], separator = '\n'): MarkdownIR {
    if (parts.length === 0) return emptyIR();
    if (parts.length === 1) return parts[0];

    let text = '';
    const styles: MarkdownStyleSpan[] = [];
    const links: MarkdownLinkSpan[] = [];

    for (let i = 0; i < parts.length; i++) {
        const offset = text.length;
        text += parts[i].text;
        if (i < parts.length - 1) text += separator;

        for (const s of parts[i].styles) styles.push({ start: s.start + offset, end: s.end + offset, style: s.style });
        for (const l of parts[i].links) links.push({ start: l.start + offset, end: l.end + offset, href: l.href });
    }

    return { text, styles, links };
}
