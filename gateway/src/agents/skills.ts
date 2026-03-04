/**
 * src/agents/skills.ts
 * Skill discovery and loader — finds SKILL.md files
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { ToolDefinition } from '../providers/interface.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('skills');

export interface Skill {
    id: string;
    name: string;
    description: string;
    tools: ToolDefinition[];
    systemPrompt?: string;
    enabled: boolean;
    source: 'bundled' | 'global' | 'workspace';
}

export class SkillManager {
    private skills: Skill[] = [];

    /**
     * Load skills from all locations
     */
    async loadSkills(workspace?: string): Promise<Skill[]> {
        this.skills = [];

        // 1. Bundled skills (shipped with gateway)
        const bundledDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../../skills');
        await this.loadDir(bundledDir, 'bundled');

        // 2. Global user skills
        const globalDir = path.join(os.homedir(), '.coreblow', 'skills');
        await this.loadDir(globalDir, 'global');

        // 3. Workspace skills
        if (workspace) {
            const wsDir = path.join(workspace, 'skills');
            await this.loadDir(wsDir, 'workspace');
        }

        log.info({ count: this.skills.length }, 'Skills loaded');
        return this.skills;
    }

    /**
     * Get all enabled skills
     */
    getEnabledSkills(): Skill[] {
        return this.skills.filter((s) => s.enabled);
    }

    /**
     * Get combined tool definitions from all enabled skills
     */
    getToolDefinitions(): ToolDefinition[] {
        return this.getEnabledSkills().flatMap((s) => s.tools);
    }

    /**
     * Get combined system prompt additions from skills
     */
    getSkillPrompts(): string {
        return this.getEnabledSkills()
            .filter((s) => s.systemPrompt)
            .map((s) => `--- Skill: ${s.name} ---\n${s.systemPrompt}`)
            .join('\n\n');
    }

    private async loadDir(dir: string, source: Skill['source']) {
        if (!fs.existsSync(dir)) return;

        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;

                const skillMd = path.join(dir, entry.name, 'SKILL.md');
                if (!fs.existsSync(skillMd)) continue;

                try {
                    const skill = this.parseSkillMd(skillMd, entry.name, source);
                    if (skill) {
                        this.skills.push(skill);
                        log.debug({ id: skill.id, source }, 'Skill loaded');
                    }
                } catch (err) {
                    log.warn({ path: skillMd, err }, 'Failed to parse skill');
                }
            }
        } catch (err) {
            log.debug({ dir, err }, 'Could not read skills directory');
        }
    }

    private parseSkillMd(filePath: string, dirName: string, source: Skill['source']): Skill | null {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Parse YAML frontmatter
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        let name = dirName;
        let description = '';

        if (fmMatch) {
            const fm = fmMatch[1];
            const nameMatch = fm.match(/name:\s*(.+)/);
            const descMatch = fm.match(/description:\s*(.+)/);
            if (nameMatch) name = nameMatch[1].trim();
            if (descMatch) description = descMatch[1].trim();
        }

        // Body after frontmatter becomes system prompt
        const body = fmMatch ? content.slice(fmMatch[0].length).trim() : content;

        return {
            id: dirName,
            name,
            description,
            tools: [],
            systemPrompt: body || undefined,
            enabled: true,
            source,
        };
    }
}
