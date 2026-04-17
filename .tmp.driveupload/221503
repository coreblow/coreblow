/**
 * CoreBlow — Data Enricher
 *
 * Enriches data records by merging from multiple
 * sources, computing derived fields, and applying
 * lookup tables.
 */

/** Enrichment source */
export interface EnrichmentSource {
    name: string;
    lookupKey: string;
    data: Map<string, Record<string, unknown>>;
}

/**
 * CoreBlow Data Enricher
 */
export class DataEnricher {
    private sources = new Map<string, EnrichmentSource>();
    private derivedFields: Array<{ name: string; fn: (record: Record<string, unknown>) => unknown }> = [];
    private stats = { enriched: 0, lookupHits: 0, lookupMisses: 0 };

    /**
     * Add a lookup source.
     */
    addSource(name: string, lookupKey: string, records: Array<Record<string, unknown>>): void {
        const data = new Map<string, Record<string, unknown>>();
        for (const r of records) {
            const key = String(r[lookupKey] ?? '');
            if (key) data.set(key, r);
        }
        this.sources.set(name, { name, lookupKey, data });
    }

    /**
     * Add a derived field.
     */
    addDerivedField(name: string, fn: (record: Record<string, unknown>) => unknown): void {
        this.derivedFields.push({ name, fn });
    }

    /**
     * Enrich a single record.
     */
    enrich(record: Record<string, unknown>, sourceNames?: string[]): Record<string, unknown> {
        let result = { ...record };
        this.stats.enriched++;

        // Lookup enrichment
        const srcs = sourceNames
            ? sourceNames.map((n) => this.sources.get(n)).filter(Boolean) as EnrichmentSource[]
            : Array.from(this.sources.values());

        for (const src of srcs) {
            const key = String(result[src.lookupKey] ?? '');
            const lookup = src.data.get(key);
            if (lookup) {
                result = { ...result, ...lookup };
                this.stats.lookupHits++;
            } else {
                this.stats.lookupMisses++;
            }
        }

        // Derived fields
        for (const { name, fn } of this.derivedFields) {
            result[name] = fn(result);
        }

        return result;
    }

    /**
     * Enrich many.
     */
    enrichMany(records: Array<Record<string, unknown>>, sourceNames?: string[]): Array<Record<string, unknown>> {
        return records.map((r) => this.enrich(r, sourceNames));
    }

    /**
     * Get stats.
     */
    getStats(): typeof this.stats { return { ...this.stats }; }

    /**
     * List sources.
     */
    list(): Array<{ name: string; lookupKey: string; size: number }> {
        return Array.from(this.sources.values()).map((s) => ({ name: s.name, lookupKey: s.lookupKey, size: s.data.size }));
    }

    /** Count sources */
    count(): number { return this.sources.size; }
}
