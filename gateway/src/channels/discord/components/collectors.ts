/**
 * Discord Component Collectors — Await user interactions on components.
 */
export interface CollectorOptions {
    timeout: number;
    maxCollect?: number;
    filter?: (interaction: Record<string, unknown>) => boolean;
}

export class ComponentCollector {
    private collected: Record<string, unknown>[] = [];
    private options: CollectorOptions;
    private ended = false;

    constructor(options: CollectorOptions) {
        this.options = options;
    }

    collect(interaction: Record<string, unknown>): boolean {
        if (this.ended) return false;
        if (this.options.filter && !this.options.filter(interaction)) return false;
        this.collected.push(interaction);
        if (this.options.maxCollect && this.collected.length >= this.options.maxCollect) this.end();
        return true;
    }

    end(): void { this.ended = true; }
    getCollected(): Record<string, unknown>[] { return [...this.collected]; }
    get isEnded(): boolean { return this.ended; }
    get count(): number { return this.collected.length; }
}