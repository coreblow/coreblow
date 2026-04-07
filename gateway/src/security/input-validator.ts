/**
 * CoreBlow — Input Validator
 *
 * Validates and sanitizes user inputs before processing.
 * Supports schema validation, type checking, string constraints,
 * and custom validation rules.
 */

/** Validation rule */
export interface ValidationRule {
    type: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'json' | 'array' | 'object';
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    custom?: (value: unknown) => string | null;
}

/** Validation schema */
export type ValidationSchema = Record<string, ValidationRule>;

/** Validation result */
export interface ValidationResult {
    valid: boolean;
    errors: Array<{ field: string; message: string }>;
    sanitized: Record<string, unknown>;
}

/**
 * CoreBlow Input Validator
 */
export class InputValidator {
    /**
     * Validate data against a schema.
     */
    validate(data: Record<string, unknown>, schema: ValidationSchema): ValidationResult {
        const errors: Array<{ field: string; message: string }> = [];
        const sanitized: Record<string, unknown> = {};

        for (const [field, rule] of Object.entries(schema)) {
            const value = data[field];

            // Required check
            if (rule.required && (value === undefined || value === null || value === '')) {
                errors.push({ field, message: `${field} is required` });
                continue;
            }
            if (value === undefined || value === null) continue;

            // Type check
            const typeError = this.checkType(field, value, rule.type);
            if (typeError) { errors.push(typeError); continue; }

            // String constraints
            if (typeof value === 'string') {
                if (rule.minLength && value.length < rule.minLength) {
                    errors.push({ field, message: `${field} must be at least ${rule.minLength} characters` });
                }
                if (rule.maxLength && value.length > rule.maxLength) {
                    errors.push({ field, message: `${field} must be at most ${rule.maxLength} characters` });
                }
                if (rule.pattern && !rule.pattern.test(value)) {
                    errors.push({ field, message: `${field} has invalid format` });
                }
            }

            // Number constraints
            if (typeof value === 'number') {
                if (rule.min !== undefined && value < rule.min) {
                    errors.push({ field, message: `${field} must be >= ${rule.min}` });
                }
                if (rule.max !== undefined && value > rule.max) {
                    errors.push({ field, message: `${field} must be <= ${rule.max}` });
                }
            }

            // Custom validator
            if (rule.custom) {
                const err = rule.custom(value);
                if (err) errors.push({ field, message: err });
            }

            sanitized[field] = value;
        }

        return { valid: errors.length === 0, errors, sanitized };
    }

    /**
     * Sanitize a string (XSS prevention).
     */
    sanitizeString(input: string): string {
        return input
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    /**
     * Validate email format.
     */
    isEmail(value: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    /**
     * Validate URL format.
     */
    isURL(value: string): boolean {
        try { new URL(value); return true; } catch { return false; }
    }

    // === Private ===

    private checkType(field: string, value: unknown, type: string): { field: string; message: string } | null {
        switch (type) {
            case 'string': return typeof value !== 'string' ? { field, message: `${field} must be a string` } : null;
            case 'number': return typeof value !== 'number' ? { field, message: `${field} must be a number` } : null;
            case 'boolean': return typeof value !== 'boolean' ? { field, message: `${field} must be a boolean` } : null;
            case 'email': return typeof value !== 'string' || !this.isEmail(value) ? { field, message: `${field} must be a valid email` } : null;
            case 'url': return typeof value !== 'string' || !this.isURL(value) ? { field, message: `${field} must be a valid URL` } : null;
            case 'json': {
                if (typeof value !== 'string') return null;
                try { JSON.parse(value); return null; } catch { return { field, message: `${field} must be valid JSON` }; }
            }
            case 'array': return !Array.isArray(value) ? { field, message: `${field} must be an array` } : null;
            case 'object': return typeof value !== 'object' || Array.isArray(value) ? { field, message: `${field} must be an object` } : null;
            default: return null;
        }
    }
}
