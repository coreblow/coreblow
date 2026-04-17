/**
 * CoreBlow — Format Converter
 *
 * Converts data between JSON, CSV, XML-like, and
 * key-value formats for data interchange.
 */

/**
 * CoreBlow Format Converter
 */
export class FormatConverter {
    /**
     * JSON to CSV.
     */
    jsonToCsv(data: Array<Record<string, unknown>>): string {
        if (data.length === 0) return '';
        const headers = Object.keys(data[0]!);
        const lines = [headers.join(',')];
        for (const row of data) {
            lines.push(headers.map((h) => {
                const val = row[h];
                const str = val === null || val === undefined ? '' : String(val);
                return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
            }).join(','));
        }
        return lines.join('\n');
    }

    /**
     * CSV to JSON.
     */
    csvToJson(csv: string): Array<Record<string, string>> {
        const lines = csv.split('\n').filter((l) => l.trim());
        if (lines.length < 2) return [];
        const headers = this.parseCsvLine(lines[0]!);
        return lines.slice(1).map((line) => {
            const values = this.parseCsvLine(line);
            const obj: Record<string, string> = {};
            headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
            return obj;
        });
    }

    /**
     * JSON to key-value pairs.
     */
    jsonToKeyValue(data: Record<string, unknown>, prefix: string = ''): Array<{ key: string; value: string }> {
        const result: Array<{ key: string; value: string }> = [];
        for (const [key, value] of Object.entries(data)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                result.push(...this.jsonToKeyValue(value as Record<string, unknown>, fullKey));
            } else {
                result.push({ key: fullKey, value: String(value) });
            }
        }
        return result;
    }

    /**
     * Key-value pairs to JSON.
     */
    keyValueToJson(pairs: Array<{ key: string; value: string }>): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        for (const { key, value } of pairs) {
            const parts = key.split('.');
            let current = result;
            for (let i = 0; i < parts.length - 1; i++) {
                if (!current[parts[i]!] || typeof current[parts[i]!] !== 'object') current[parts[i]!] = {};
                current = current[parts[i]!] as Record<string, unknown>;
            }
            current[parts[parts.length - 1]!] = value;
        }
        return result;
    }

    /**
     * Flatten nested object.
     */
    flatten(data: Record<string, unknown>, prefix: string = ''): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                Object.assign(result, this.flatten(value as Record<string, unknown>, fullKey));
            } else {
                result[fullKey] = value;
            }
        }
        return result;
    }

    /**
     * Unflatten dot-notation object.
     */
    unflatten(data: Record<string, unknown>): Record<string, unknown> {
        return this.keyValueToJson(Object.entries(data).map(([key, value]) => ({ key, value: String(value) })));
    }

    // === Private ===
    private parseCsvLine(line: string): string[] {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i]!;
            if (ch === '"') { inQuotes = !inQuotes; }
            else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
            else { current += ch; }
        }
        result.push(current);
        return result;
    }
}
