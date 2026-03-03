/**
 * CoreBlow — Schema Validator
 *
 * Validates JSON data against schemas with nested
 * object support, array validation, enums, and
 * detailed error paths.
 */

/** Schema definition */
export interface SchemaField {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'enum';
    required?: boolean;
    items?: SchemaField; // For arrays
    properties?: Record<string, SchemaField>; // For objects
    enum?: unknown[]; // For enums
    description?: string;
    default?: unknown;
}

export type Schema = Record<string, SchemaField>;

/** Validation error */
export interface SchemaError {
    path: string;
    message: string;
    expected: string;
    actual: string;
}

/**
 * CoreBlow Schema Validator
 */
export class SchemaValidator {
    private schemas = new Map<string, Schema>();

    /**
     * Register a named schema.
     */
    register(name: string, schema: Schema): void {
        this.schemas.set(name, schema);
    }

    /**
     * Validate data against a named schema.
     */
    validate(schemaName: string, data: Record<string, unknown>): { valid: boolean; errors: SchemaError[] } {
        const schema = this.schemas.get(schemaName);
        if (!schema) return { valid: false, errors: [{ path: '', message: `Schema "${schemaName}" not found`, expected: 'schema', actual: 'undefined' }] };
        return this.validateObject(data, schema, '');
    }

    /**
     * Validate directly against a schema object.
     */
    validateDirect(data: Record<string, unknown>, schema: Schema): { valid: boolean; errors: SchemaError[] } {
        return this.validateObject(data, schema, '');
    }

    /**
     * Apply defaults from schema.
     */
    applyDefaults(data: Record<string, unknown>, schema: Schema): Record<string, unknown> {
        const result = { ...data };
        for (const [key, field] of Object.entries(schema)) {
            if (result[key] === undefined && field.default !== undefined) {
                result[key] = field.default;
            }
        }
        return result;
    }

    /**
     * Generate sample data from schema.
     */
    generateSample(schema: Schema): Record<string, unknown> {
        const sample: Record<string, unknown> = {};
        for (const [key, field] of Object.entries(schema)) {
            sample[key] = this.sampleValue(field);
        }
        return sample;
    }

    /**
     * List registered schemas.
     */
    list(): string[] {
        return Array.from(this.schemas.keys());
    }

    /**
     * Get a schema.
     */
    get(name: string): Schema | null {
        return this.schemas.get(name) ?? null;
    }

    /** Count */
    count(): number { return this.schemas.size; }

    // === Private ===

    private validateObject(data: Record<string, unknown>, schema: Schema, prefix: string): { valid: boolean; errors: SchemaError[] } {
        const errors: SchemaError[] = [];

        for (const [key, field] of Object.entries(schema)) {
            const path = prefix ? `${prefix}.${key}` : key;
            const value = data[key];

            if (value === undefined || value === null) {
                if (field.required) errors.push({ path, message: `${path} is required`, expected: field.type, actual: 'undefined' });
                continue;
            }

            const typeErr = this.checkType(value, field, path);
            if (typeErr) errors.push(typeErr);

            // Nested object
            if (field.type === 'object' && field.properties && typeof value === 'object' && !Array.isArray(value)) {
                const nested = this.validateObject(value as Record<string, unknown>, field.properties, path);
                errors.push(...nested.errors);
            }

            // Array items
            if (field.type === 'array' && field.items && Array.isArray(value)) {
                for (let i = 0; i < value.length; i++) {
                    const itemErr = this.checkType(value[i], field.items, `${path}[${i}]`);
                    if (itemErr) errors.push(itemErr);
                }
            }
        }

        return { valid: errors.length === 0, errors };
    }

    private checkType(value: unknown, field: SchemaField, path: string): SchemaError | null {
        switch (field.type) {
            case 'string': return typeof value !== 'string' ? { path, message: `Expected string`, expected: 'string', actual: typeof value } : null;
            case 'number': return typeof value !== 'number' ? { path, message: `Expected number`, expected: 'number', actual: typeof value } : null;
            case 'boolean': return typeof value !== 'boolean' ? { path, message: `Expected boolean`, expected: 'boolean', actual: typeof value } : null;
            case 'object': return typeof value !== 'object' || Array.isArray(value) ? { path, message: `Expected object`, expected: 'object', actual: typeof value } : null;
            case 'array': return !Array.isArray(value) ? { path, message: `Expected array`, expected: 'array', actual: typeof value } : null;
            case 'enum': return field.enum && !field.enum.includes(value) ? { path, message: `Must be one of: ${field.enum.join(', ')}`, expected: `enum`, actual: String(value) } : null;
            default: return null;
        }
    }

    private sampleValue(field: SchemaField): unknown {
        switch (field.type) {
            case 'string': return field.default ?? 'example';
            case 'number': return field.default ?? 0;
            case 'boolean': return field.default ?? false;
            case 'enum': return field.enum?.[0] ?? null;
            case 'array': return field.items ? [this.sampleValue(field.items)] : [];
            case 'object': return field.properties ? this.generateSample(field.properties) : {};
            default: return null;
        }
    }
}
