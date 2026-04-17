/**
 * CoreBlow — Data Transformer
 *
 * Applies chainable transformations to data records.
 * Supports map, filter, rename, pick, omit, compute,
 * and custom transform functions.
 */

/** Transform operation */
export type TransformOp =
    | { type: 'rename'; from: string; to: string }
    | { type: 'pick'; fields: string[] }
    | { type: 'omit'; fields: string[] }
    | { type: 'compute'; field: string; fn: (record: Record<string, unknown>) => unknown }
    | { type: 'default'; field: string; value: unknown }
    | { type: 'cast'; field: string; to: 'string' | 'number' | 'boolean' };

/**
 * CoreBlow Data Transformer
 */
export class DataTransformer {
    private ops: TransformOp[] = [];

    /**
     * Add a rename operation.
     */
    rename(from: string, to: string): this { this.ops.push({ type: 'rename', from, to }); return this; }

    /**
     * Pick only specified fields.
     */
    pick(fields: string[]): this { this.ops.push({ type: 'pick', fields }); return this; }

    /**
     * Omit specified fields.
     */
    omit(fields: string[]): this { this.ops.push({ type: 'omit', fields }); return this; }

    /**
     * Add a computed field.
     */
    compute(field: string, fn: (record: Record<string, unknown>) => unknown): this { this.ops.push({ type: 'compute', field, fn }); return this; }

    /**
     * Set default value.
     */
    default(field: string, value: unknown): this { this.ops.push({ type: 'default', field, value }); return this; }

    /**
     * Cast field type.
     */
    cast(field: string, to: 'string' | 'number' | 'boolean'): this { this.ops.push({ type: 'cast', field, to }); return this; }

    /**
     * Apply all transforms to a single record.
     */
    transform(record: Record<string, unknown>): Record<string, unknown> {
        let result = { ...record };
        for (const op of this.ops) {
            switch (op.type) {
                case 'rename': { const val = result[op.from]; delete result[op.from]; result[op.to] = val; break; }
                case 'pick': { const picked: Record<string, unknown> = {}; for (const f of op.fields) if (f in result) picked[f] = result[f]; result = picked; break; }
                case 'omit': { for (const f of op.fields) delete result[f]; break; }
                case 'compute': { result[op.field] = op.fn(result); break; }
                case 'default': { if (result[op.field] === undefined || result[op.field] === null) result[op.field] = op.value; break; }
                case 'cast': {
                    const v = result[op.field];
                    if (op.to === 'string') result[op.field] = String(v);
                    else if (op.to === 'number') result[op.field] = Number(v);
                    else if (op.to === 'boolean') result[op.field] = Boolean(v);
                    break;
                }
            }
        }
        return result;
    }

    /**
     * Apply to an array.
     */
    transformMany(records: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
        return records.map((r) => this.transform(r));
    }

    /**
     * Reset operations.
     */
    reset(): void { this.ops = []; }

    /** Count ops */
    count(): number { return this.ops.length; }
}
