/**
 * src/skills/install.ts
 *
 * Helpers for discovering, fetching, and installing remote skills.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getSkillRegistry } from './registry.js';
import { parseSkillContent } from './parser.js';

export interface InstallResult {
    success: boolean;
    skillId?: string;
    error?: string;
}

/**
 * Installs a skill from a remote URL containing the SKILL.md content.
 */
export async function installSkillFromUrl(url: string, targetDir: string): Promise<InstallResult> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return { success: false, error: `Failed to fetch: ${response.statusText}` };
        }

        const content = await response.text();
        const parsed = parseSkillContent(content);

        if (!parsed || !parsed.meta.name) {
            return { success: false, error: 'Invalid SKILL.md format or missing name.' };
        }

        const skillId = parsed.meta.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const skillDir = path.join(targetDir, skillId);

        if (fs.existsSync(skillDir)) {
            return { success: false, error: 'Skill already installed.' };
        }

        fs.mkdirSync(skillDir, { recursive: true });
        const filePath = path.join(skillDir, 'SKILL.md');
        fs.writeFileSync(filePath, content, 'utf-8');

        // Immediately register
        const registry = getSkillRegistry();
        // Assume discover handles it, but since we know it, we can just trigger a rescan or manually add
        await registry.discover(targetDir, 'remote');

        return { success: true, skillId };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
}
