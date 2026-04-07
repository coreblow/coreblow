/**
 * agents/context-window-guard.ts
 * Guard to prevent exceeding context window limits.
 */
import { SAFETY_MARGIN } from './compaction.js';

export interface ContextWindowGuardConfig { contextWindow: number; reserveTokens?: number; safetyMargin?: number; warningThreshold?: number; }

export class ContextWindowGuard {
    private config: ContextWindowGuardConfig;
    private currentTokens = 0;

    constructor(config: ContextWindowGuardConfig) { this.config = config; }

    get effectiveLimit(): number {
        const margin = this.config.safetyMargin ?? SAFETY_MARGIN;
        return Math.floor((this.config.contextWindow - (this.config.reserveTokens ?? 0)) / margin);
    }

    get remaining(): number { return Math.max(0, this.effectiveLimit - this.currentTokens); }
    get usage(): number { return this.currentTokens / this.effectiveLimit; }
    get isNearLimit(): boolean { return this.usage >= (this.config.warningThreshold ?? 0.8); }
    get isExceeded(): boolean { return this.currentTokens >= this.effectiveLimit; }

    add(tokens: number): void { this.currentTokens += tokens; }
    set(tokens: number): void { this.currentTokens = tokens; }
    reset(): void { this.currentTokens = 0; }

    canFit(additionalTokens: number): boolean { return this.currentTokens + additionalTokens <= this.effectiveLimit; }

    formatStatus(): string {
        const pct = (this.usage * 100).toFixed(1);
        const icon = this.isExceeded ? '🔴' : this.isNearLimit ? '🟡' : '🟢';
        return `${icon} Context: ${this.currentTokens.toLocaleString()} / ${this.effectiveLimit.toLocaleString()} (${pct}%)`;
    }
}
