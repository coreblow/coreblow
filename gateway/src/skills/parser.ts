/**
 * src/skills/parser.ts
 * SKILL.md Parser — reads frontmatter YAML + markdown instructions
 */

import fs from 'node:fs';
import path from 'node:path';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('skills:parser');

export interface SkillMeta {
    name: string;
    description: string;
    homepage?: string;
    'user-invocable'?: boolean;
    'disable-model-invocation'?: boolean;
    'command-dispatch'?: 'tool' | 'prompt';
    'command-tool'?: string;
    metadata?: Record<string, any>;
}

export interface ParsedSkill {
    meta: SkillMeta;
    instructions: string;    // markdown body (system prompt injection)
    filePath: string;
    dirPath: string;
}

/**
 * Parse a SKILL.md file
 */
export function parseSkillFile(filePath: string): ParsedSkill | null {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return parseSkillContent(content, filePath);
    } catch (err: any) {
        log.error({ filePath, err: err.message }, 'Failed to read SKILL.md');
        return null;
    }
}

/**
 * Parse SKILL.md content string
 */
export function parseSkillContent(content: string, filePath: string = ''): ParsedSkill | null {
    // Extract frontmatter (between --- delimiters)
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (!fmMatch) {
        log.warn({ filePath }, 'No frontmatter found');
        return null;
    }

    const [, frontmatter, body] = fmMatch;
    const meta = parseFrontmatter(frontmatter);

    if (!meta.name) {
        log.warn({ filePath }, 'Skill missing name');
        return null;
    }

    return {
        meta,
        instructions: body.trim(),
        filePath,
        dirPath: path.dirname(filePath),
    };
}

/**
 * Simple YAML-like frontmatter parser (no external deps)
 */
function parseFrontmatter(text: string): SkillMeta {
    const result: any = {};

    for (const line of text.split('\n')) {
        const match = line.match(/^([a-zA-Z_-]+):\s*(.+)$/);
        if (!match) continue;

        const [, key, rawValue] = match;
        let value: any = rawValue.trim();

        // Parse types
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (/^\d+$/.test(value)) value = parseInt(value);
        else if (value.startsWith('{')) {
            try { value = JSON.parse(value); } catch { /* keep string */ }
        }
        // Remove quotes
        else if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        result[key] = value;
    }

    return result as SkillMeta;
}
