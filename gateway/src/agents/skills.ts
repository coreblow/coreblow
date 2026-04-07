/**
 * CoreBlow Skills Install & Hub System
 *
 * Manages skill discovery, installation, validation, and hub operations.
 * Skills are self-contained instruction packs that extend agent capabilities.
 *
 * Consolidates: CoreBlow skills-install.ts (514), skills-hub.ts (502) = 1,016 LOC total.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('skills');

// ─── Types ────────────────────────────────────────────────────────

export interface SkillManifest {
    name: string;
    version: string;
    description: string;
    author?: string;
    license?: string;
    tags?: string[];
    requires?: string[];
    instructions: string;
    examples?: string[];
    scripts?: string[];
    icon?: string;
}

export interface InstalledSkill {
    manifest: SkillManifest;
    installPath: string;
    installedAt: number;
    source: 'local' | 'hub' | 'url' | 'inline';
    enabled: boolean;
    usageCount: number;
}

export interface SkillHubEntry {
    name: string;
    version: string;
    description: string;
    author: string;
    downloads: number;
    rating: number;
    tags: string[];
    url: string;
    sha256?: string;
    updatedAt: string;
}

export interface SkillSearchResult {
    query: string;
    total: number;
    results: SkillHubEntry[];
}

export interface SkillValidation {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

// ─── Skill Registry ──────────────────────────────────────────────

const installedSkills = new Map<string, InstalledSkill>();

/**
 * Get all installed skills
 */
export function getInstalledSkills(): InstalledSkill[] {
    return Array.from(installedSkills.values());
}

/**
 * Get a specific installed skill
 */
export function getSkill(name: string): InstalledSkill | undefined {
    return installedSkills.get(normalizeSkillName(name));
}

/**
 * Check if a skill is installed
 */
export function isSkillInstalled(name: string): boolean {
    return installedSkills.has(normalizeSkillName(name));
}

/**
 * Install a skill from a local directory
 */
export function installSkillFromDir(skillDir: string): InstalledSkill | null {
    const manifest = loadSkillManifest(skillDir);
    if (!manifest) {
        log.error({ dir: skillDir }, 'No valid manifest found');
        return null;
    }

    const validation = validateManifest(manifest);
    if (!validation.valid) {
        log.error({ name: manifest.name, errors: validation.errors }, 'Invalid skill manifest');
        return null;
    }

    const skill: InstalledSkill = {
        manifest,
        installPath: path.resolve(skillDir),
        installedAt: Date.now(),
        source: 'local',
        enabled: true,
        usageCount: 0,
    };

    installedSkills.set(normalizeSkillName(manifest.name), skill);
    log.info({ name: manifest.name, version: manifest.version, path: skillDir }, 'Skill installed');
    return skill;
}

/**
 * Install a skill from inline content
 */
export function installSkillInline(name: string, instructions: string, meta?: Partial<SkillManifest>): InstalledSkill {
    const manifest: SkillManifest = {
        name,
        version: meta?.version ?? '1.0.0',
        description: meta?.description ?? name,
        instructions,
        tags: meta?.tags,
        author: meta?.author,
    };

    const skill: InstalledSkill = {
        manifest,
        installPath: '',
        installedAt: Date.now(),
        source: 'inline',
        enabled: true,
        usageCount: 0,
    };

    installedSkills.set(normalizeSkillName(name), skill);
    log.info({ name, source: 'inline' }, 'Inline skill installed');
    return skill;
}

/**
 * Uninstall a skill
 */
export function uninstallSkill(name: string): boolean {
    const normalized = normalizeSkillName(name);
    const removed = installedSkills.delete(normalized);
    if (removed) log.info({ name }, 'Skill uninstalled');
    return removed;
}

/**
 * Enable or disable a skill
 */
export function setSkillEnabled(name: string, enabled: boolean): boolean {
    const skill = installedSkills.get(normalizeSkillName(name));
    if (!skill) return false;
    skill.enabled = enabled;
    log.debug({ name, enabled }, 'Skill state changed');
    return true;
}

/**
 * Increment usage count for a skill
 */
export function recordSkillUsage(name: string): void {
    const skill = installedSkills.get(normalizeSkillName(name));
    if (skill) skill.usageCount++;
}

/**
 * Clear all installed skills
 */
export function clearInstalledSkills(): void {
    installedSkills.clear();
}

// ─── Skill Discovery ─────────────────────────────────────────────

/**
 * Scan a workspace for skills directories
 */
export function discoverWorkspaceSkills(workspaceDir: string): string[] {
    const dirs = [
        path.join(workspaceDir, '.agents', 'skills'),
        path.join(workspaceDir, '.agent', 'skills'),
        path.join(workspaceDir, '_agents', 'skills'),
        path.join(workspaceDir, '_agent', 'skills'),
        path.join(workspaceDir, '.coreblow', 'skills'),
    ];

    const found: string[] = [];
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const skillDir = path.join(dir, entry.name);
                    const manifestPath = path.join(skillDir, 'SKILL.md');
                    if (fs.existsSync(manifestPath)) {
                        found.push(skillDir);
                    }
                }
            }
        } catch {
            // Skip unreadable directories
        }
    }

    return found;
}

/**
 * Auto-install all skills found in a workspace
 */
export function autoInstallWorkspaceSkills(workspaceDir: string): InstalledSkill[] {
    const skillDirs = discoverWorkspaceSkills(workspaceDir);
    const installed: InstalledSkill[] = [];

    for (const dir of skillDirs) {
        const skill = installSkillFromDir(dir);
        if (skill) installed.push(skill);
    }

    log.info({ count: installed.length, workspace: workspaceDir }, 'Workspace skills auto-installed');
    return installed;
}

// ─── Manifest Handling ────────────────────────────────────────────

/**
 * Load a skill manifest from a directory
 */
export function loadSkillManifest(skillDir: string): SkillManifest | null {
    const manifestPath = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(manifestPath)) return null;

    try {
        const content = fs.readFileSync(manifestPath, 'utf-8');
        return parseSkillMarkdown(content, skillDir);
    } catch (err) {
        log.error({ path: manifestPath, error: (err as Error).message }, 'Failed to load manifest');
        return null;
    }
}

/**
 * Parse SKILL.md format (YAML frontmatter + markdown body)
 */
export function parseSkillMarkdown(content: string, dir?: string): SkillManifest {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

    let frontmatter: Record<string, unknown> = {};
    let instructions = content;

    if (frontmatterMatch) {
        const yamlRaw = frontmatterMatch[1]!;
        instructions = frontmatterMatch[2]!.trim();

        // Simple YAML parsing (key: value pairs)
        for (const line of yamlRaw.split('\n')) {
            const match = line.match(/^(\w+)\s*:\s*(.+)$/);
            if (match) {
                const [, key, value] = match;
                frontmatter[key!] = value!.trim().replace(/^['"]|['"]$/g, '');
            }
        }
    }

    return {
        name: String(frontmatter['name'] ?? path.basename(dir ?? 'unknown')),
        version: String(frontmatter['version'] ?? '1.0.0'),
        description: String(frontmatter['description'] ?? ''),
        author: frontmatter['author'] ? String(frontmatter['author']) : undefined,
        license: frontmatter['license'] ? String(frontmatter['license']) : undefined,
        instructions,
    };
}

/**
 * Validate a skill manifest
 */
export function validateManifest(manifest: SkillManifest): SkillValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!manifest.name || manifest.name.trim().length === 0) {
        errors.push('Skill name is required');
    }
    if (!manifest.instructions || manifest.instructions.trim().length === 0) {
        errors.push('Skill instructions are required');
    }
    if (!manifest.version) {
        warnings.push('No version specified, defaulting to 1.0.0');
    }
    if (!manifest.description) {
        warnings.push('No description provided');
    }
    if (manifest.name && manifest.name.length > 64) {
        errors.push('Skill name too long (max 64 chars)');
    }

    return { valid: errors.length === 0, errors, warnings };
}

// ─── Skills Prompt Builder ────────────────────────────────────────

/**
 * Build the skills section for the system prompt
 */
export function buildSkillsPrompt(skills?: InstalledSkill[]): string {
    const enabledSkills = (skills ?? getInstalledSkills()).filter((s) => s.enabled);
    if (enabledSkills.length === 0) return '';

    const lines: string[] = ['<available_skills>'];

    for (const skill of enabledSkills) {
        lines.push(`### ${skill.manifest.name}`);
        if (skill.manifest.description) {
            lines.push(skill.manifest.description);
        }
        lines.push('');
        lines.push(skill.manifest.instructions);
        lines.push('');
    }

    lines.push('</available_skills>');
    return lines.join('\n');
}

// ─── Hub Operations ────────────────────────────────────────────────

const HUB_REGISTRY: SkillHubEntry[] = [];

/**
 * Register a hub entry (for testing/local hub)
 */
export function registerHubEntry(entry: SkillHubEntry): void {
    HUB_REGISTRY.push(entry);
}

/**
 * Search the skills hub
 */
export function searchHub(query: string, limit: number = 20): SkillSearchResult {
    const queryLower = query.toLowerCase();
    const results = HUB_REGISTRY
        .filter((entry) =>
            entry.name.toLowerCase().includes(queryLower) ||
            entry.description.toLowerCase().includes(queryLower) ||
            entry.tags.some((t) => t.toLowerCase().includes(queryLower)),
        )
        .slice(0, limit);

    return { query, total: results.length, results };
}

/**
 * Get hub entry by name
 */
export function getHubEntry(name: string): SkillHubEntry | undefined {
    return HUB_REGISTRY.find((e) => e.name.toLowerCase() === name.toLowerCase());
}

/**
 * Clear the hub registry
 */
export function clearHubRegistry(): void {
    HUB_REGISTRY.length = 0;
}

// ─── Helpers ──────────────────────────────────────────────────────

function normalizeSkillName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, '-');
}
