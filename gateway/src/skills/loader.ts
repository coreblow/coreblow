/**
 * src/skills/loader.ts
 * Skills loader — scans directories, watches for changes, injects into agent context
 */

import fs from 'node:fs';
import path from 'node:path';
import { createChildLogger } from '../utils/logger.js';
import { parseSkillFile, type ParsedSkill } from './parser.js';
import { getHomeDir } from '../gateway/config.js';

const log = createChildLogger('skills:loader');

export class SkillsManager {
    private skills: Map<string, ParsedSkill> = new Map();
    private watchers: fs.FSWatcher[] = [];
    private envOverrides: Map<string, Record<string, string>> = new Map();

    /**
     * Load skills from multiple directories
     */
    async loadAll(): Promise<void> {
        const homeDir = getHomeDir();
        const searchPaths = [
            path.join(path.dirname(new URL(import.meta.url).pathname), '../../skills'),  // bundled
            path.join(homeDir, 'skills'),                                                  // user
            path.join(process.cwd(), 'skills'),                                            // workspace
        ];

        for (const searchPath of searchPaths) {
            if (!fs.existsSync(searchPath)) continue;
            await this.scanDirectory(searchPath);
        }

        log.info({ count: this.skills.size }, 'Skills loaded');
    }

    /**
     * Scan a directory for SKILL.md files
     */
    private async scanDirectory(dir: string): Promise<void> {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            const skillFile = path.join(dir, entry.name, 'SKILL.md');
            if (!fs.existsSync(skillFile)) continue;

            const skill = parseSkillFile(skillFile);
            if (skill) {
                this.skills.set(skill.meta.name, skill);
                log.debug({ name: skill.meta.name }, 'Skill loaded');
            }
        }
    }

    /**
     * Watch skill directories for changes (auto-reload)
     */
    watch(): void {
        const homeDir = getHomeDir();
        const dirs = [
            path.join(homeDir, 'skills'),
            path.join(process.cwd(), 'skills'),
        ];

        for (const dir of dirs) {
            if (!fs.existsSync(dir)) continue;

            const watcher = fs.watch(dir, { recursive: true }, async (event, filename) => {
                if (filename?.endsWith('SKILL.md')) {
                    log.info({ filename }, 'Skill file changed, reloading...');
                    this.skills.clear();
                    await this.loadAll();
                }
            });

            this.watchers.push(watcher);
        }
    }

    /**
     * Set environment overrides for a skill (from config.json)
     */
    setEnvOverrides(skillName: string, env: Record<string, string>): void {
        this.envOverrides.set(skillName, env);
    }

    /**
     * Get environment for a skill execution
     */
    getSkillEnv(skillName: string): Record<string, string> {
        return this.envOverrides.get(skillName) || {};
    }

    /**
     * Build system prompt additions from all active skills
     */
    buildSystemPrompt(): string {
        const parts: string[] = [];

        for (const skill of this.skills.values()) {
            if (skill.meta['disable-model-invocation']) continue;

            parts.push(`\n## Skill: ${skill.meta.name}\n${skill.meta.description}\n\n${skill.instructions}`);
        }

        return parts.length > 0
            ? `\n\n# Available Skills\n${parts.join('\n\n---\n')}`
            : '';
    }

    /**
     * Get a specific skill
     */
    get(name: string): ParsedSkill | undefined {
        return this.skills.get(name);
    }

    /**
     * List all loaded skills
     */
    list(): ParsedSkill[] {
        return Array.from(this.skills.values());
    }

    /**
     * Stop watching
     */
    stopWatching(): void {
        for (const w of this.watchers) w.close();
        this.watchers = [];
    }
}
