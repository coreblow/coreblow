import { describe, it, expect } from 'vitest';
import { safeEvaluateMath, sanitizeMathExpression } from './calculator.js';

describe('calculator', () => {
    describe('sanitizeMathExpression', () => {
        it('removes non-math characters', () => {
            expect(sanitizeMathExpression('2+3')).toBe('2+3');
            // sanitize keeps letters (needed for sin/cos/PI), strips special chars
            expect(sanitizeMathExpression('2+3; DROP TABLE')).not.toContain(';');
        });
    });

    describe('safeEvaluateMath', () => {
        // Basic arithmetic
        it('adds numbers', () => expect(safeEvaluateMath('2+3')).toBe(5));
        it('subtracts numbers', () => expect(safeEvaluateMath('10-3')).toBe(7));
        it('multiplies numbers', () => expect(safeEvaluateMath('4*5')).toBe(20));
        it('divides numbers', () => expect(safeEvaluateMath('10/4')).toBe(2.5));
        it('modulo', () => expect(safeEvaluateMath('7%3')).toBe(1));
        it('power', () => expect(safeEvaluateMath('2^3')).toBe(8));

        // Operator precedence
        it('respects multiplication over addition', () => expect(safeEvaluateMath('2+3*4')).toBe(14));
        it('respects parentheses', () => expect(safeEvaluateMath('(2+3)*4')).toBe(20));
        it('nested parens', () => expect(safeEvaluateMath('((2+3)*(4+1))')).toBe(25));

        // Unary minus
        it('unary minus', () => expect(safeEvaluateMath('-5')).toBe(-5));
        it('unary minus with parens', () => expect(safeEvaluateMath('-(3+2)')).toBe(-5));

        // Functions
        it('sqrt', () => expect(safeEvaluateMath('sqrt(16)')).toBe(4));
        it('abs', () => expect(safeEvaluateMath('abs(-5)')).toBe(5));
        it('ceil', () => expect(safeEvaluateMath('ceil(3.2)')).toBe(4));
        it('floor', () => expect(safeEvaluateMath('floor(3.8)')).toBe(3));
        it('round', () => expect(safeEvaluateMath('round(3.5)')).toBe(4));
        it('sin(0)', () => expect(safeEvaluateMath('sin(0)')).toBe(0));
        it('pow(2,3)', () => expect(safeEvaluateMath('pow(2,3)')).toBe(8));
        it('min(3,1,2)', () => expect(safeEvaluateMath('min(3,1,2)')).toBe(1));
        it('max(3,1,2)', () => expect(safeEvaluateMath('max(3,1,2)')).toBe(3));

        // Constants
        it('PI', () => expect(safeEvaluateMath('PI')).toBeCloseTo(Math.PI));
        it('E', () => expect(safeEvaluateMath('E')).toBeCloseTo(Math.E));

        // Complex expressions
        it('complex: sqrt(16) + pow(2,3)', () => expect(safeEvaluateMath('sqrt(16) + pow(2,3)')).toBe(12));

        // Error cases
        it('throws on empty', () => expect(() => safeEvaluateMath('')).toThrow());
        it('throws on division by zero', () => expect(() => safeEvaluateMath('1/0')).toThrow());

        // SECURITY: Attack vectors — must ALL throw
        it('rejects process.exit()', () => expect(() => safeEvaluateMath('process.exit()')).toThrow());
        it('rejects require()', () => expect(() => safeEvaluateMath("require('fs')")).toThrow());
        it('rejects constructor', () => expect(() => safeEvaluateMath('constructor')).toThrow());
        it('rejects __proto__', () => expect(() => safeEvaluateMath('__proto__')).toThrow());
        it('rejects Function()', () => expect(() => safeEvaluateMath('Function')).toThrow());
    });
});
