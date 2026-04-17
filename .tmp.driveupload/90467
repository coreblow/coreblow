/**
 * markdown/fences.ts
 * Code fence detection and extraction.
 * Ported from OpenClaw src/markdown/fences.ts.
 */

export interface CodeFence {
    language: string;
    code: string;
    startLine: number;
    endLine: number;
}

const FENCE_OPEN_RE = /^(`{3,}|~{3,})([^\s`]*)\s*$/;

/**
 * Extract all code fences from markdown text.
 */
export function extractCodeFences(markdown: string): CodeFence[] {
    const lines = markdown.split('\n');
    const fences: CodeFence[] = [];
    let i = 0;

    while (i < lines.length) {
        const match = lines[i].match(FENCE_OPEN_RE);
        if (match) {
            const marker = match[1];
            const language = match[2] || '';
            const startLine = i;
            const codeLines: string[] = [];
            i++;

            while (i < lines.length) {
                if (lines[i].trim() === marker.charAt(0).repeat(marker.length)) {
                    fences.push({ language, code: codeLines.join('\n'), startLine, endLine: i });
                    i++;
                    break;
                }
                codeLines.push(lines[i]);
                i++;
            }
        } else {
            i++;
        }
    }

    return fences;
}

/**
 * Strip code fences from markdown, replacing with placeholder.
 */
export function stripCodeFences(markdown: string, placeholder = '[CODE_BLOCK]'): string {
    const fences = extractCodeFences(markdown);
    if (fences.length === 0) return markdown;

    const lines = markdown.split('\n');
    const result: string[] = [];
    let skip = -1;

    for (let i = 0; i < lines.length; i++) {
        const fence = fences.find((f) => f.startLine === i);
        if (fence) { result.push(placeholder); skip = fence.endLine; continue; }
        if (i <= skip) continue;
        result.push(lines[i]);
    }

    return result.join('\n');
}

/**
 * Detect the language of a code fence from its content (heuristic).
 */
export function detectLanguage(code: string): string | null {
    const trimmed = code.trim();
    if (trimmed.startsWith('#!/usr/bin/env node') || trimmed.startsWith('const ') || trimmed.startsWith('import ')) return 'javascript';
    if (trimmed.startsWith('#!/usr/bin/env python') || trimmed.startsWith('def ') || trimmed.match(/^\s*import /m)) return 'python';
    if (trimmed.startsWith('#!/bin/bash') || trimmed.startsWith('#!/bin/sh') || trimmed.match(/^\s*\$\s/m)) return 'bash';
    if (trimmed.match(/^\s*\{[\s\S]*\}\s*$/)) return 'json';
    if (trimmed.startsWith('<')) return 'html';
    return null;
}
