/**
 * src/skills/parser.ts
 * SKILL.md Parser — reads frontmatter YAML + markdown instructions
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
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
    metadata?: Record<string, unknown>;
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
    } catch (err: unknown) {
        log.error({ filePath, err: err instanceof Error ? err.message : String(err) }, 'Failed to read SKILL.md');
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
 * Build deeply nested objects from dotted or indented keys.
 * For simplicity, we can do a quick nested parse.
 */
function parseFrontmatter(text: string): SkillMeta {
    const result: Partial<SkillMeta> & Record<string, unknown> = { name: '', description: '' };

    let currentKey: string | null = null;
    let currentList: unknown[] | null = null;
    let currentMap: Record<string, any> | null = null;

    for (const line of text.split('\n')) {
        const matchMap = line.match(/^([a-zA-Z_-]+):\s*$/);
        if (matchMap) {
             currentKey = matchMap[1]!;
             currentMap = {};
             result[currentKey] = currentMap;
             currentList = null;
             continue;
        }

        const matchMapItem = line.match(/^\s+([a-zA-Z_-]+):\s*(.+)$/);
        if (matchMapItem && currentMap) {
             let [, key, rawValue] = matchMapItem;
             currentMap[key!] = parseYamlValue(rawValue!);
             continue;
        }

        const matchListItem = line.match(/^\s*-\s+(.+)$/);
        if (matchListItem) {
            if (currentKey && !currentList && !currentMap) {
                 currentList = [];
                 result[currentKey] = currentList;
            }
            if (currentList) {
                currentList.push(parseYamlValue(matchListItem[1]!));
            }
            continue;
        }

        const match = line.match(/^([a-zA-Z_-]+):\s*(.+)$/);
        if (!match) continue;

        const [, key, rawValue] = match;

        currentKey = key!;
        currentList = null;
        currentMap = null;

        result[key!] = parseYamlValue(rawValue!);
    }

    return result as SkillMeta;
}

function parseYamlValue(rawValue: string): unknown {
    let value: string | boolean | number | Record<string, unknown> = rawValue.trim();

    // Parse types
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (/^\d+$/.test(value as string)) return parseInt(value as string);
    if ((value as string).startsWith('{')) {
        try { return JSON.parse(value as string); } catch { /* keep string */ }
    }
    // Remove quotes
    if (((value as string).startsWith('"') && (value as string).endsWith('"')) ||
        ((value as string).startsWith("'") && (value as string).endsWith("'"))) {
        return (value as string).slice(1, -1);
    }
    // Array inline
    if ((value as string).startsWith('[') && (value as string).endsWith(']')) {
        return (value as string).slice(1, -1).split(',').map(s => parseYamlValue(s.trim()));
    }

    return value;
}
