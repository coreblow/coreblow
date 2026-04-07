/**
 * gateway/server-methods/validation.ts — Validation helpers for RPC params.
 */

import {
    ErrorCodes,
    errorShape,
    formatValidationErrors,
    type Validator,
} from '../protocol/index.js';
import type { RespondFn } from './types.js';

export function assertValidParams<T>(
    params: unknown,
    validator: Validator<T>,
    methodName: string,
    respond: RespondFn,
): params is T {
    if (!validator(params)) {
        respond(
            false,
            undefined,
            errorShape(
                ErrorCodes.INVALID_REQUEST,
                `invalid ${methodName} params: ${formatValidationErrors(validator.errors)}`,
            ),
        );
        return false;
    }
    return true;
}

/**
 * Helper to build custom lightweight object validators manually (no Ajv dependency).
 */
export function buildObjectValidator<T>(
    schema: {
        required?: string[];
        properties?: Record<string, { type: string; enum?: unknown[] }>;
    }
): Validator<T> {
    const v: Validator<T> = (data: unknown): data is T => {
        v.errors = [];
        if (typeof data !== 'object' || data === null) {
            v.errors.push({ message: 'Must be an object' });
            return false;
        }

        const obj = data as Record<string, unknown>;

        if (schema.required) {
            for (const req of schema.required) {
                if (!(req in obj)) {
                    v.errors.push({ path: req, message: `Required property missing` });
                }
            }
        }

        if (schema.properties) {
            for (const [key, propConfig] of Object.entries(schema.properties)) {
                if (key in obj) {
                    const val = obj[key];
                    if (propConfig.type === 'array' && !Array.isArray(val)) {
                        v.errors.push({ path: key, message: `Must be an array` });
                    } else if (propConfig.type !== 'array' && typeof val !== propConfig.type) {
                        v.errors.push({ path: key, message: `Must be of type ${propConfig.type}` });
                    }

                    if (propConfig.enum && !propConfig.enum.includes(val)) {
                        v.errors.push({ path: key, message: `Must be one of: ${propConfig.enum.join(', ')}` });
                    }
                }
            }
        }

        return v.errors.length === 0;
    };
    return v;
}
