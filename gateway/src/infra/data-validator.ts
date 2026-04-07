/**
 * CoreBlow — Data Validator
 *
 * Validates data records against rules with detailed
 * error reporting, batch validation, and custom rules.
 */

/** Validation rule */
export interface ValidationRule {
    field: string;
    check: 'required' | 'minLength' | 'maxLength' | 'min' | 'max' | 'pattern' | 'custom';
    value?: unknown;
    message?: string;
    customFn?: (val: unknown) => boolean;
}

/** Validation error */
export interface ValidationError {
    field: string;
    rule: string;
    message: string;
    value: unknown;
}

/** Validation result */
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
}

/**
 * CoreBlow Data Validator
 */
export class DataValidator {
    private rules: ValidationRule[] = [];

    /**
     * Add a rule.
     */
    addRule(rule: ValidationRule): this { this.rules.push(rule); return this; }

    /**
     * Add required rule.
     */
    required(field: string, message?: string): this { return this.addRule({ field, check: 'required', message }); }

    /**
     * Add min length rule.
     */
    minLength(field: string, min: number, message?: string): this { return this.addRule({ field, check: 'minLength', value: min, message }); }

    /**
     * Add max rule.
     */
    max(field: string, maxVal: number, message?: string): this { return this.addRule({ field, check: 'max', value: maxVal, message }); }

    /**
     * Add pattern rule.
     */
    pattern(field: string, regex: RegExp, message?: string): this { return this.addRule({ field, check: 'pattern', value: regex, message }); }

    /**
     * Add custom rule.
     */
    custom(field: string, fn: (val: unknown) => boolean, message?: string): this { return this.addRule({ field, check: 'custom', customFn: fn, message }); }

    /**
     * Validate a record.
     */
    validate(record: Record<string, unknown>): ValidationResult {
        const errors: ValidationError[] = [];

        for (const rule of this.rules) {
            const val = record[rule.field];
            let passed = true;

            switch (rule.check) {
                case 'required': passed = val !== undefined && val !== null && val !== ''; break;
                case 'minLength': passed = typeof val === 'string' && val.length >= (rule.value as number); break;
                case 'maxLength': passed = typeof val === 'string' && val.length <= (rule.value as number); break;
                case 'min': passed = typeof val === 'number' && val >= (rule.value as number); break;
                case 'max': passed = typeof val === 'number' && val <= (rule.value as number); break;
                case 'pattern': passed = typeof val === 'string' && (rule.value as RegExp).test(val); break;
                case 'custom': passed = rule.customFn ? rule.customFn(val) : true; break;
            }

            if (!passed) {
                errors.push({ field: rule.field, rule: rule.check, message: rule.message ?? `${rule.field} failed ${rule.check}`, value: val });
            }
        }

        return { valid: errors.length === 0, errors };
    }

    /**
     * Validate many.
     */
    validateMany(records: Array<Record<string, unknown>>): Array<{ index: number; result: ValidationResult }> {
        return records.map((r, i) => ({ index: i, result: this.validate(r) })).filter((r) => !r.result.valid);
    }

    /**
     * Reset rules.
     */
    reset(): void { this.rules = []; }

    /** Count */
    count(): number { return this.rules.length; }
}
