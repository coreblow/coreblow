/**
 * CoreBlow — API Versioning Docs
 *
 * Documents API versions, migration guides,
 * deprecation notices, and breaking changes.
 */

/** API version */
export interface ApiVersion {
    version: string;
    releaseDate: string;
    status: 'current' | 'deprecated' | 'sunset';
    changes: Array<{ type: 'added' | 'changed' | 'deprecated' | 'removed' | 'fixed'; description: string }>;
    migrationGuide?: string;
    sunsetDate?: string;
}

/**
 * CoreBlow API Versioning Docs
 */
export class ApiVersioningDocs {
    private versions: ApiVersion[] = [];

    /**
     * Add a version.
     */
    addVersion(version: ApiVersion): void {
        this.versions.push(version);
        this.versions.sort((a, b) => b.version.localeCompare(a.version));
    }

    /**
     * Get current version.
     */
    getCurrent(): ApiVersion | null {
        return this.versions.find((v) => v.status === 'current') ?? null;
    }

    /**
     * Get deprecated versions.
     */
    getDeprecated(): ApiVersion[] {
        return this.versions.filter((v) => v.status === 'deprecated');
    }

    /**
     * Get breaking changes between versions.
     */
    getBreakingChanges(fromVersion: string, toVersion: string): Array<{ version: string; changes: string[] }> {
        const result: Array<{ version: string; changes: string[] }> = [];
        const fromIdx = this.versions.findIndex((v) => v.version === fromVersion);
        const toIdx = this.versions.findIndex((v) => v.version === toVersion);
        if (fromIdx === -1 || toIdx === -1) return result;
        const start = Math.min(fromIdx, toIdx);
        const end = Math.max(fromIdx, toIdx);
        for (let i = start; i <= end; i++) {
            const v = this.versions[i]!;
            const breaking = v.changes.filter((c) => c.type === 'removed' || c.type === 'changed').map((c) => c.description);
            if (breaking.length > 0) result.push({ version: v.version, changes: breaking });
        }
        return result;
    }

    /**
     * Generate changelog markdown.
     */
    toMarkdown(): string {
        const lines: string[] = ['# API Changelog\n'];
        for (const v of this.versions) {
            const badge = v.status === 'current' ? ' ✅' : v.status === 'deprecated' ? ' ⚠️' : ' ❌';
            lines.push(`## ${v.version}${badge}\n`);
            lines.push(`**Released:** ${v.releaseDate} | **Status:** ${v.status}\n`);
            if (v.sunsetDate) lines.push(`**Sunset:** ${v.sunsetDate}\n`);
            const groups: Record<string, string[]> = {};
            for (const c of v.changes) {
                if (!groups[c.type]) groups[c.type] = [];
                groups[c.type]!.push(c.description);
            }
            for (const [type, items] of Object.entries(groups)) {
                lines.push(`### ${type.charAt(0).toUpperCase() + type.slice(1)}\n`);
                for (const item of items) lines.push(`- ${item}`);
                lines.push('');
            }
            if (v.migrationGuide) {
                lines.push('### Migration Guide\n');
                lines.push(v.migrationGuide + '\n');
            }
        }
        return lines.join('\n');
    }

    /** Count */
    count(): number { return this.versions.length; }
}
