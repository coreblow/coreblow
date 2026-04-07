/**
 * cli/progress.ts
 * Terminal progress indicators (spinner, progress bar).
 * Ported from OpenClaw cli-utils + progress patterns.
 */

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const SPINNER_INTERVAL = 80;

export class Spinner {
    private frameIndex = 0;
    private interval: ReturnType<typeof setInterval> | null = null;
    private message: string;
    private stream: NodeJS.WriteStream;

    constructor(message: string, stream: NodeJS.WriteStream = process.stderr) {
        this.message = message;
        this.stream = stream;
    }

    start(): this {
        if (this.interval) return this;
        if (!this.stream.isTTY) { this.stream.write(`${this.message}...\n`); return this; }
        this.render();
        this.interval = setInterval(() => this.render(), SPINNER_INTERVAL);
        return this;
    }

    update(message: string): void {
        this.message = message;
        if (this.stream.isTTY) this.render();
    }

    succeed(message?: string): void {
        this.stop(`✅ ${message ?? this.message}`);
    }

    fail(message?: string): void {
        this.stop(`❌ ${message ?? this.message}`);
    }

    warn(message?: string): void {
        this.stop(`⚠️  ${message ?? this.message}`);
    }

    stop(finalMessage?: string): void {
        if (this.interval) { clearInterval(this.interval); this.interval = null; }
        if (this.stream.isTTY) { this.stream.write('\r\x1b[K'); }
        if (finalMessage) this.stream.write(`${finalMessage}\n`);
    }

    private render(): void {
        const frame = SPINNER_FRAMES[this.frameIndex % SPINNER_FRAMES.length];
        this.frameIndex++;
        this.stream.write(`\r\x1b[K${frame} ${this.message}`);
    }
}

export class ProgressBar {
    private current = 0;
    private total: number;
    private width: number;
    private label: string;
    private stream: NodeJS.WriteStream;

    constructor(label: string, total: number, width = 30, stream: NodeJS.WriteStream = process.stderr) {
        this.label = label; this.total = total; this.width = width; this.stream = stream;
    }

    update(current: number): void {
        this.current = Math.min(current, this.total);
        if (!this.stream.isTTY) return;
        const pct = this.total > 0 ? this.current / this.total : 0;
        const filled = Math.round(pct * this.width);
        const empty = this.width - filled;
        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        this.stream.write(`\r\x1b[K${this.label} [${bar}] ${Math.round(pct * 100)}%`);
    }

    increment(amount = 1): void { this.update(this.current + amount); }

    finish(message?: string): void {
        this.update(this.total);
        if (this.stream.isTTY) this.stream.write('\r\x1b[K');
        if (message) this.stream.write(`${message}\n`);
    }
}

/**
 * Run a task with a spinner.
 */
export async function withSpinner<T>(message: string, fn: (spinner: Spinner) => Promise<T>): Promise<T> {
    const spinner = new Spinner(message);
    spinner.start();
    try {
        const result = await fn(spinner);
        spinner.succeed();
        return result;
    } catch (err) {
        spinner.fail();
        throw err;
    }
}
