/**
 * CoreBlow — Config Exporter
 *
 * Exports and imports gateway configurations in multiple
 * formats. Supports env files, JSON, YAML-like, Docker
 * Compose snippets, and redacted exports for sharing.
 */

/** Export format */
export type ConfigFormat = 'json' | 'env' | 'yaml' | 'docker-compose' | 'toml';

/** Export options */
export interface ConfigExportOptions {
    format: ConfigFormat;
    redactSecrets?: boolean;
    includeDefaults?: boolean;
    sections?: string[];
}

/**
 * CoreBlow Config Exporter
 */
export class ConfigExporter {
    /**
     * Export config to specified format.
     */
    export(config: Record<string, unknown>, opts: ConfigExportOptions): string {
        const filtered = opts.sections
            ? this.filterSections(config, opts.sections)
            : config;
        const processed = opts.redactSecrets ? this.redactSecrets(filtered) : filtered;

        switch (opts.format) {
            case 'json': return this.toJSON(processed);
            case 'env': return this.toEnv(processed);
            case 'yaml': return this.toYAML(processed);
            case 'docker-compose': return this.toDockerCompose(processed);
            case 'toml': return this.toTOML(processed);
            default: return this.toJSON(processed);
        }
    }

    /**
     * Import from env format.
     */
    importEnv(envContent: string): Record<string, string> {
        const result: Record<string, string> = {};
        for (const line of envContent.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx === -1) continue;
            const key = trimmed.slice(0, eqIdx).trim();
            let value = trimmed.slice(eqIdx + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            result[key] = value;
        }
        return result;
    }

    /**
     * Merge two configs (b overrides a).
     */
    merge(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
        const result = { ...a };
        for (const [key, val] of Object.entries(b)) {
            if (val !== null && typeof val === 'object' && !Array.isArray(val) && typeof result[key] === 'object') {
                result[key] = this.merge(result[key] as Record<string, unknown>, val as Record<string, unknown>);
            } else {
                result[key] = val;
            }
        }
        return result;
    }

    /**
     * Diff two configs.
     */
    diff(a: Record<string, unknown>, b: Record<string, unknown>): Array<{ key: string; old: unknown; new: unknown }> {
        const diffs: Array<{ key: string; old: unknown; new: unknown }> = [];
        const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const key of Array.from(allKeys)) {
            if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
                diffs.push({ key, old: a[key], new: b[key] });
            }
        }
        return diffs;
    }

    // === Formatters ===

    private toJSON(config: Record<string, unknown>): string {
        return JSON.stringify(config, null, 2);
    }

    private toEnv(config: Record<string, unknown>, prefix?: string): string {
        const lines: string[] = [];
        for (const [key, val] of Object.entries(config)) {
            const envKey = prefix ? `${prefix}_${key}`.toUpperCase() : key.toUpperCase();
            if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
                lines.push(this.toEnv(val as Record<string, unknown>, envKey));
            } else {
                lines.push(`${envKey}=${JSON.stringify(val)}`);
            }
        }
        return lines.join('\n');
    }

    private toYAML(config: Record<string, unknown>, indent: number = 0): string {
        const pad = '  '.repeat(indent);
        const lines: string[] = [];
        for (const [key, val] of Object.entries(config)) {
            if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
                lines.push(`${pad}${key}:`);
                lines.push(this.toYAML(val as Record<string, unknown>, indent + 1));
            } else {
                lines.push(`${pad}${key}: ${JSON.stringify(val)}`);
            }
        }
        return lines.join('\n');
    }

    private toDockerCompose(config: Record<string, unknown>): string {
        const envLines = this.toEnv(config).split('\n').map((l) => `      - ${l}`).join('\n');
        return `version: "3.8"\nservices:\n  coreblow:\n    image: coreblow/gateway:latest\n    ports:\n      - "3000:3000"\n    environment:\n${envLines}`;
    }

    private toTOML(config: Record<string, unknown>): string {
        const lines: string[] = [];
        for (const [key, val] of Object.entries(config)) {
            if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
                lines.push(`\n[${key}]`);
                for (const [k2, v2] of Object.entries(val as Record<string, unknown>)) {
                    lines.push(`${k2} = ${JSON.stringify(v2)}`);
                }
            } else {
                lines.push(`${key} = ${JSON.stringify(val)}`);
            }
        }
        return lines.join('\n');
    }

    // === Helpers ===

    private redactSecrets(obj: Record<string, unknown>): Record<string, unknown> {
        const secretKeys = ['key', 'secret', 'token', 'password', 'apikey', 'api_key'];
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(obj)) {
            if (secretKeys.some((s) => key.toLowerCase().includes(s)) && typeof val === 'string') {
                result[key] = val.length > 4 ? '****' + val.slice(-4) : '****';
            } else if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
                result[key] = this.redactSecrets(val as Record<string, unknown>);
            } else {
                result[key] = val;
            }
        }
        return result;
    }

    private filterSections(config: Record<string, unknown>, sections: string[]): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        for (const section of sections) {
            if (config[section] !== undefined) result[section] = config[section];
        }
        return result;
    }
}
