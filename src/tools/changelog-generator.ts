/**
 * CoreBlow — Changelog Generator
 *
 * Generates changelogs from structured entries with
 * semantic versioning, categories, markdown output,
 * and comparison between versions.
 */

/** Changelog entry */
export interface ChangelogEntry {
    version: string;
    date: string;
    categories: {
        added?: string[];
        changed?: string[];
        deprecated?: string[];
        removed?: string[];
        fixed?: string[];
        security?: string[];
    };
}

/**
 * CoreBlow Changelog Generator
 */
export class ChangelogGenerator {
    private entries: ChangelogEntry[] = [];

    /**
     * Add a version entry.
     */
    addEntry(entry: ChangelogEntry): void {
        this.entries.push(entry);
        this.entries.sort((a, b) => this.compareVersion(b.version, a.version));
    }

    /**
     * Generate markdown changelog.
     */
    generateMarkdown(): string {
        const lines: string[] = ['# Changelog', '', 'All notable changes to CoreBlow Gateway.', ''];

        for (const entry of this.entries) {
            lines.push(`## [${entry.version}] - ${entry.date}`);
            lines.push('');

            for (const [category, items] of Object.entries(entry.categories)) {
                if (!items || items.length === 0) continue;
                lines.push(`### ${this.capitalize(category)}`);
                for (const item of items) lines.push(`- ${item}`);
                lines.push('');
            }
        }

        return lines.join('\n');
    }

    /**
     * Generate JSON changelog.
     */
    generateJSON(): string {
        return JSON.stringify(this.entries, null, 2);
    }

    /**
     * Get changes between two versions.
     */
    diff(fromVersion: string, toVersion: string): ChangelogEntry[] {
        return this.entries.filter((e) =>
            this.compareVersion(e.version, fromVersion) > 0 &&
            this.compareVersion(e.version, toVersion) <= 0
        );
    }

    /**
     * Get latest entry.
     */
    getLatest(): ChangelogEntry | null {
        return this.entries[0] ?? null;
    }

    /**
     * Get entry for a version.
     */
    getVersion(version: string): ChangelogEntry | null {
        return this.entries.find((e) => e.version === version) ?? null;
    }

    /**
     * List versions.
     */
    listVersions(): string[] {
        return this.entries.map((e) => e.version);
    }

    /** Count */
    count(): number { return this.entries.length; }

    // === Private ===
    private capitalize(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
    private compareVersion(a: string, b: string): number {
        const pa = a.split('.').map(Number);
        const pb = b.split('.').map(Number);
        for (let i = 0; i < 3; i++) { if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0); }
        return 0;
    }
}
