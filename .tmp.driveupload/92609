/**
 * CoreBlow — Environment Manager
 *
 * Manages environment variables with validation,
 * type coercion, defaults, required checks, and
 * .env file parsing.
 */

/** Env var definition */
export interface EnvVar {
    key: string;
    type: 'string' | 'number' | 'boolean';
    required: boolean;
    default?: unknown;
    description?: string;
}

/**
 * CoreBlow Environment Manager
 */
export class EnvManager {
    private definitions = new Map<string, EnvVar>();
    private values = new Map<string, unknown>();

    /**
     * Define an env var.
     */
    define(key: string, type: EnvVar['type'], required: boolean = false, defaultValue?: unknown, description?: string): void {
        this.definitions.set(key, { key, type, required, default: defaultValue, description });
    }

    /**
     * Load from a Record (simulating process.env).
     */
    load(env: Record<string, string | undefined>): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        for (const [key, def] of Array.from(this.definitions)) {
            const raw = env[key];

            if (raw === undefined || raw === '') {
                if (def.required && def.default === undefined) {
                    errors.push(`Missing required env var: ${key}`);
                    continue;
                }
                this.values.set(key, def.default);
                continue;
            }

            // Type coercion
            switch (def.type) {
                case 'number': {
                    const num = Number(raw);
                    if (isNaN(num)) errors.push(`${key} must be a number, got "${raw}"`);
                    else this.values.set(key, num);
                    break;
                }
                case 'boolean':
                    this.values.set(key, raw === 'true' || raw === '1' || raw === 'yes');
                    break;
                case 'string':
                default:
                    this.values.set(key, raw);
            }
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Get a value.
     */
    get<T = unknown>(key: string): T | undefined {
        return this.values.get(key) as T | undefined;
    }

    /**
     * Get with fallback.
     */
    getOrDefault<T = unknown>(key: string, fallback: T): T {
        return (this.values.get(key) as T) ?? fallback;
    }

    /**
     * Set a value.
     */
    set(key: string, value: unknown): void {
        this.values.set(key, value);
    }

    /**
     * Parse .env file content.
     */
    parseEnvFile(content: string): Record<string, string> {
        const result: Record<string, string> = {};
        for (const line of content.split('\n')) {
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
     * List definitions.
     */
    list(): Array<{ key: string; type: string; required: boolean; hasValue: boolean }> {
        return Array.from(this.definitions.values()).map((d) => ({
            key: d.key, type: d.type, required: d.required, hasValue: this.values.has(d.key),
        }));
    }

    /** Count */
    count(): number { return this.definitions.size; }
}
