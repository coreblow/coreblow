/**
 * tools/builtin/calculator.ts
 *
 * Safe math expression evaluator using a recursive descent parser.
 * NO eval(), NO new Function() — pure computation only.
 *
 * Supported:
 *   - Basic arithmetic: +, -, *, /, %, ^
 *   - Parentheses: (2+3)*4
 *   - Unary minus: -5, -(3+2)
 *   - Functions: sin, cos, tan, abs, sqrt, pow, log, ceil, floor, round, min, max
 *   - Constants: PI, E
 */

import { isValidMathExpression } from '../../security/input-sanitizer.js';

// ─── Tokenizer ──────────────────────────────────────────────────

type TokenType = 'number' | 'op' | 'lparen' | 'rparen' | 'comma' | 'func' | 'const';
interface Token { type: TokenType; value: string; }

const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'abs', 'sqrt', 'pow', 'log', 'ceil', 'floor', 'round', 'min', 'max']);
const CONSTANTS: Record<string, number> = { PI: Math.PI, E: Math.E };

function tokenize(expr: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    while (i < expr.length) {
        const ch = expr[i];

        // Whitespace
        if (/\s/.test(ch)) { i++; continue; }

        // Number (integer or decimal)
        if (/[0-9.]/.test(ch)) {
            let num = '';
            while (i < expr.length && /[0-9.eE]/.test(expr[i])) {
                num += expr[i++];
            }
            tokens.push({ type: 'number', value: num });
            continue;
        }

        // Identifier: function name or constant
        if (/[a-zA-Z_]/.test(ch)) {
            let id = '';
            while (i < expr.length && /[a-zA-Z_0-9]/.test(expr[i])) {
                id += expr[i++];
            }
            const upper = id.toUpperCase();
            if (upper in CONSTANTS) {
                tokens.push({ type: 'const', value: upper });
            } else if (FUNCTIONS.has(id.toLowerCase())) {
                tokens.push({ type: 'func', value: id.toLowerCase() });
            } else {
                throw new Error(`Unknown identifier: ${id}`);
            }
            continue;
        }

        // Operators
        if ('+-*/%^'.includes(ch)) {
            tokens.push({ type: 'op', value: ch });
            i++;
            continue;
        }

        if (ch === '(') { tokens.push({ type: 'lparen', value: '(' }); i++; continue; }
        if (ch === ')') { tokens.push({ type: 'rparen', value: ')' }); i++; continue; }
        if (ch === ',') { tokens.push({ type: 'comma', value: ',' }); i++; continue; }

        throw new Error(`Unexpected character: ${ch}`);
    }
    return tokens;
}

// ─── Parser (Recursive Descent) ─────────────────────────────────

class Parser {
    private tokens: Token[];
    private pos = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    parse(): number {
        const result = this.expression();
        if (this.pos < this.tokens.length) {
            throw new Error(`Unexpected token: ${this.tokens[this.pos].value}`);
        }
        return result;
    }

    // expression = term (('+' | '-') term)*
    private expression(): number {
        let result = this.term();
        while (this.pos < this.tokens.length && this.tokens[this.pos].type === 'op'
            && (this.tokens[this.pos].value === '+' || this.tokens[this.pos].value === '-')) {
            const op = this.tokens[this.pos++].value;
            const right = this.term();
            result = op === '+' ? result + right : result - right;
        }
        return result;
    }

    // term = power (('*' | '/' | '%') power)*
    private term(): number {
        let result = this.power();
        while (this.pos < this.tokens.length && this.tokens[this.pos].type === 'op'
            && ('*/%'.includes(this.tokens[this.pos].value))) {
            const op = this.tokens[this.pos++].value;
            const right = this.power();
            if (op === '*') result *= right;
            else if (op === '/') {
                if (right === 0) throw new Error('Division by zero');
                result /= right;
            } else {
                result %= right;
            }
        }
        return result;
    }

    // power = unary ('^' unary)*  (right-associative)
    private power(): number {
        const base = this.unary();
        if (this.pos < this.tokens.length && this.tokens[this.pos].type === 'op'
            && this.tokens[this.pos].value === '^') {
            this.pos++;
            const exp = this.power(); // right-associative recursion
            return Math.pow(base, exp);
        }
        return base;
    }

    // unary = '-' unary | primary
    private unary(): number {
        if (this.pos < this.tokens.length && this.tokens[this.pos].type === 'op'
            && this.tokens[this.pos].value === '-') {
            this.pos++;
            return -this.unary();
        }
        return this.primary();
    }

    // primary = number | constant | func '(' args ')' | '(' expression ')'
    private primary(): number {
        if (this.pos >= this.tokens.length) {
            throw new Error('Unexpected end of expression');
        }

        const token = this.tokens[this.pos];

        // Number
        if (token.type === 'number') {
            this.pos++;
            const val = parseFloat(token.value);
            if (isNaN(val)) throw new Error(`Invalid number: ${token.value}`);
            return val;
        }

        // Constant (PI, E)
        if (token.type === 'const') {
            this.pos++;
            return CONSTANTS[token.value];
        }

        // Function call
        if (token.type === 'func') {
            const funcName = token.value;
            this.pos++;
            this.expect('lparen');
            const args = this.argList();
            this.expect('rparen');
            return this.callFunction(funcName, args);
        }

        // Parenthesized expression
        if (token.type === 'lparen') {
            this.pos++;
            const result = this.expression();
            this.expect('rparen');
            return result;
        }

        throw new Error(`Unexpected token: ${token.value}`);
    }

    // argList = expression (',' expression)*
    private argList(): number[] {
        const args: number[] = [this.expression()];
        while (this.pos < this.tokens.length && this.tokens[this.pos].type === 'comma') {
            this.pos++;
            args.push(this.expression());
        }
        return args;
    }

    private expect(type: TokenType): void {
        if (this.pos >= this.tokens.length || this.tokens[this.pos].type !== type) {
            const found = this.pos < this.tokens.length ? this.tokens[this.pos].value : 'EOF';
            throw new Error(`Expected ${type}, got: ${found}`);
        }
        this.pos++;
    }

    private callFunction(name: string, args: number[]): number {
        switch (name) {
            case 'sin':   return Math.sin(args[0]);
            case 'cos':   return Math.cos(args[0]);
            case 'tan':   return Math.tan(args[0]);
            case 'abs':   return Math.abs(args[0]);
            case 'sqrt':  return Math.sqrt(args[0]);
            case 'log':   return Math.log(args[0]);
            case 'ceil':  return Math.ceil(args[0]);
            case 'floor': return Math.floor(args[0]);
            case 'round': return Math.round(args[0]);
            case 'pow':   if (args.length < 2) throw new Error('pow requires 2 arguments'); return Math.pow(args[0], args[1]);
            case 'min':   if (args.length < 2) throw new Error('min requires 2+ arguments'); return Math.min(...args);
            case 'max':   if (args.length < 2) throw new Error('max requires 2+ arguments'); return Math.max(...args);
            default:      throw new Error(`Unknown function: ${name}`);
        }
    }
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Sanitize a math expression by removing non-math characters.
 */
export function sanitizeMathExpression(expr: string): string {
    return expr.replace(/[^0-9a-zA-Z_+\-*/().%^,\s]/g, '');
}

/**
 * Safely evaluate a math expression using a recursive descent parser.
 * No eval() or new Function() — pure computation.
 *
 * @throws Error if expression is invalid or contains dangerous patterns
 */
export function safeEvaluateMath(expr: string): number {
    if (!expr || !expr.trim()) throw new Error('Empty expression');

    // Pre-check with input-sanitizer
    if (!isValidMathExpression(expr)) {
        throw new Error('Expression contains invalid characters');
    }

    const sanitized = sanitizeMathExpression(expr);
    const tokens = tokenize(sanitized);
    if (tokens.length === 0) throw new Error('Empty expression');

    const parser = new Parser(tokens);
    const result = parser.parse();

    if (!isFinite(result)) throw new Error('Result is not finite');
    return result;
}
