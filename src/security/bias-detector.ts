/**
 * CoreBlow — Bias Detector
 *
 * Production-grade bias detection with intersectional analysis,
 * balanced representation checking, counter-example awareness,
 * and comprehensive reporting for AI output fairness auditing.
 */

import { clamp } from "../utils.js";
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('security:bias');

// ─── Types ───────────────────────────────────────────────────────

/** Bias category */
export type BiasCategory =
    | 'gender' | 'racial' | 'age' | 'political'
    | 'socioeconomic' | 'disability' | 'religious' | 'cultural';

/** Bias severity */
export type BiasSeverity = 'none' | 'low' | 'medium' | 'high';

/** Bias indicator */
export interface BiasIndicator {
    category: BiasCategory;
    score: number;
    severity: BiasSeverity;
    indicators: string[];
    suggestion: string;
    mitigated: boolean;
}

/** Bias result */
export interface BiasResult {
    biased: boolean;
    overallScore: number;
    severity: BiasSeverity;
    indicators: BiasIndicator[];
    recommendation: string;
    balanceScore: number;
}

/** Batch bias result */
export interface BatchBiasResult {
    results: BiasResult[];
    totalBiased: number;
    averageScore: number;
    prevalentCategory?: BiasCategory;
}

/** Bias detector configuration */
export interface BiasConfig {
    /** Detection threshold (0-1, default: 0.4) */
    threshold?: number;
    /** Categories to scan */
    enabledCategories?: BiasCategory[];
    /** Check for balanced representation */
    checkBalance?: boolean;
}

/** Category definition */
interface CategoryTermDef {
    terms: RegExp[];
    stereotypes: RegExp[];
    inclusive: RegExp[];
    suggestion: string;
    weight: number;
}

// ─── BiasDetector ────────────────────────────────────────────────

/**
 * CoreBlow Bias Detector
 *
 * Scans text for potential biases across 8 categories with
 * stereotype detection, inclusive language checking, and
 * balance scoring.
 */
export class BiasDetector {
    private categories: Map<BiasCategory, CategoryTermDef>;
    private threshold: number;
    private enabledCategories: Set<BiasCategory>;
    private checkBalance: boolean;
    private stats = { scanned: 0, biasDetected: 0, byCategory: new Map<BiasCategory, number>() };
    private history: Array<{ text: string; result: BiasResult; timestamp: number }> = [];
    private maxHistory = 200;

    constructor(config?: BiasConfig) {
        this.threshold = config?.threshold ?? 0.4;
        this.checkBalance = config?.checkBalance ?? true;
        this.enabledCategories = new Set(config?.enabledCategories ?? [
            'gender', 'racial', 'age', 'political',
            'socioeconomic', 'disability', 'religious', 'cultural',
        ]);

        this.categories = new Map<BiasCategory, CategoryTermDef>([
            ['gender', {
                terms: [/\b(mankind|manmade|chairman|policeman|fireman|stewardess|mailman)\b/gi],
                stereotypes: [/\b(women\s+(?:can't|cannot|shouldn't|are\s+bad\s+at))\b/gi, /\b(men\s+(?:don't|never|are\s+bad\s+at))\b/gi],
                inclusive: [/\b(humankind|synthetic|chairperson|police\s+officer|firefighter|flight\s+attendant|mail\s+carrier)\b/gi],
                suggestion: 'Consider using gender-neutral language',
                weight: 0.5,
            }],
            ['racial', {
                terms: [/\b(those\s+people|their\s+kind|all\s+\w+\s+people\s+are)\b/gi],
                stereotypes: [/\b(\w+\s+people\s+always|\w+\s+people\s+never)\b/gi],
                inclusive: [/\b(diverse|inclusive|multicultural|cross-cultural|equitable)\b/gi],
                suggestion: 'Ensure culturally sensitive and inclusive language',
                weight: 0.8,
            }],
            ['age', {
                terms: [/\b(old\s+people|elderly\s+are|youngsters\s+are|boomers\s+are|millennials\s+are)\b/gi],
                stereotypes: [/\b(too\s+old\s+to|too\s+young\s+to|kids\s+these\s+days)\b/gi],
                inclusive: [/\b(age-inclusive|multigenerational|experienced\s+professionals|emerging\s+talent)\b/gi],
                suggestion: 'Avoid age-based generalizations',
                weight: 0.4,
            }],
            ['political', {
                terms: [/\b(liberal|conservative|left-wing|right-wing)\s+(always|never|are\s+all)\b/gi],
                stereotypes: [/\b(all\s+(?:liberals|conservatives|democrats|republicans)\s+are)\b/gi],
                inclusive: [/\b(nonpartisan|bipartisan|balanced\s+perspective|multiple\s+viewpoints)\b/gi],
                suggestion: 'Maintain political neutrality',
                weight: 0.5,
            }],
            ['socioeconomic', {
                terms: [/\b(poor\s+people\s+are|rich\s+people\s+are|lower\s+class|upper\s+class)\b/gi],
                stereotypes: [/\b(welfare\s+(?:queen|cheat)|entitled\s+rich|lazy\s+poor)\b/gi],
                inclusive: [/\b(economic\s+diversity|income\s+spectrum|socioeconomically\s+diverse)\b/gi],
                suggestion: 'Avoid socioeconomic stereotyping',
                weight: 0.5,
            }],
            ['disability', {
                terms: [/\b(crippled|handicapped|lame|crazy|insane|retarded)\b/gi],
                stereotypes: [/\b(confined\s+to\s+a\s+wheelchair|suffers\s+from|victim\s+of)\b/gi],
                inclusive: [/\b(person\s+with\s+disability|uses\s+a\s+wheelchair|lives\s+with|neurodiverse)\b/gi],
                suggestion: 'Use person-first language for disabilities',
                weight: 0.9,
            }],
            ['religious', {
                terms: [/\b(all\s+(?:muslims|christians|jews|hindus)\s+are)\b/gi],
                stereotypes: [/\b(religious\s+(?:fanatics|zealots)|godless)\b/gi],
                inclusive: [/\b(interfaith|multi-faith|religiously\s+diverse|secular\s+and\s+religious)\b/gi],
                suggestion: 'Maintain religious neutrality and respect',
                weight: 0.6,
            }],
            ['cultural', {
                terms: [/\b(primitive|uncivilized|backward|third\s+world)\b/gi],
                stereotypes: [/\b(exotic|oriental|those\s+countries)\b/gi],
                inclusive: [/\b(culturally\s+aware|cross-cultural|global\s+perspective|cultural\s+competency)\b/gi],
                suggestion: 'Use culturally respectful terminology',
                weight: 0.9,
            }],
        ]);
    }

    // ─── Analysis ────────────────────────────────────────────────

    /**
     * Analyze text for bias.
     */
    analyze(text: string): BiasResult {
        this.stats.scanned++;
        const indicators: BiasIndicator[] = [];
        let maxScore = 0;
        let highestSeverity: BiasSeverity = 'none';
        let inclusiveCount = 0;
        let biasedTermCount = 0;

        for (const [cat, def] of this.categories) {
            if (!this.enabledCategories.has(cat)) continue;

            const biasedTerms: string[] = [];
            const stereotypeTerms: string[] = [];
            const inclusiveTerms: string[] = [];

            // Check biased terms
            for (const re of def.terms) {
                const matches = text.match(new RegExp(re.source, re.flags));
                if (matches) biasedTerms.push(...matches);
            }

            // Check stereotypes (stronger signal)
            for (const re of def.stereotypes) {
                const matches = text.match(new RegExp(re.source, re.flags));
                if (matches) stereotypeTerms.push(...matches);
            }

            // Check inclusive terms (mitigation)
            for (const re of def.inclusive) {
                const matches = text.match(new RegExp(re.source, re.flags));
                if (matches) inclusiveTerms.push(...matches);
            }

            const allFound = [...biasedTerms, ...stereotypeTerms];
            if (allFound.length > 0) {
                let score = Math.min(1, (biasedTerms.length * 0.25 + stereotypeTerms.length * 0.5) * def.weight);

                // Mitigation: inclusive language reduces score
                const mitigated = inclusiveTerms.length > 0;
                if (mitigated) {
                    score = Math.max(0, score - inclusiveTerms.length * 0.1);
                }

                const severity = this.scoreSeverity(score);

                indicators.push({
                    category: cat,
                    score,
                    severity,
                    indicators: [...new Set(allFound)],
                    suggestion: def.suggestion,
                    mitigated,
                });

                maxScore = Math.max(maxScore, score);
                biasedTermCount += allFound.length;

                if (this.severityRank(severity) > this.severityRank(highestSeverity)) {
                    highestSeverity = severity;
                }

                this.stats.byCategory.set(cat, (this.stats.byCategory.get(cat) ?? 0) + 1);
            }

            inclusiveCount += inclusiveTerms.length;
        }

        const biased = maxScore >= this.threshold;
        if (biased) this.stats.biasDetected++;

        // Balance score: ratio of inclusive to biased terms (higher is better)
        const balanceScore = biasedTermCount > 0
            ? Math.min(1, inclusiveCount / biasedTermCount)
            : 1.0;

        const result: BiasResult = {
            biased,
            overallScore: maxScore,
            severity: biased ? highestSeverity : 'none',
            indicators,
            recommendation: biased
                ? `Potential bias detected. ${indicators.map((i) => i.suggestion).join('. ')}`
                : 'No significant bias detected',
            balanceScore,
        };

        this.recordHistory(text.slice(0, 100), result);
        return result;
    }

    /**
     * Batch scan multiple texts.
     */
    analyzeBatch(texts: string[]): BatchBiasResult {
        const results = texts.map((t) => this.analyze(t));
        const totalBiased = results.filter((r) => r.biased).length;
        const averageScore = results.length > 0
            ? results.reduce((s, r) => s + r.overallScore, 0) / results.length
            : 0;

        const catCounts = new Map<BiasCategory, number>();
        for (const r of results) {
            for (const ind of r.indicators) {
                catCounts.set(ind.category, (catCounts.get(ind.category) ?? 0) + 1);
            }
        }
        let prevalentCategory: BiasCategory | undefined;
        let maxCount = 0;
        for (const [cat, count] of catCounts) {
            if (count > maxCount) { prevalentCategory = cat; maxCount = count; }
        }

        return { results, totalBiased, averageScore, prevalentCategory };
    }

    /**
     * Quick check.
     */
    isBiased(text: string): boolean {
        return this.analyze(text).biased;
    }

    // ─── Configuration ───────────────────────────────────────────

    setThreshold(threshold: number): void {
        this.threshold = clamp(threshold, 0, 1);
    }

    getThreshold(): number { return this.threshold; }

    enableCategory(cat: BiasCategory): void { this.enabledCategories.add(cat); }
    disableCategory(cat: BiasCategory): void { this.enabledCategories.delete(cat); }
    getEnabledCategories(): BiasCategory[] { return Array.from(this.enabledCategories); }

    // ─── Statistics ──────────────────────────────────────────────

    getStats(): { scanned: number; biasDetected: number; biasRate: number; byCategory: Record<string, number> } {
        const byCategory: Record<string, number> = {};
        for (const [cat, count] of this.stats.byCategory) byCategory[cat] = count;
        return {
            scanned: this.stats.scanned,
            biasDetected: this.stats.biasDetected,
            biasRate: this.stats.scanned > 0 ? this.stats.biasDetected / this.stats.scanned : 0,
            byCategory,
        };
    }

    getHistory(): Array<{ text: string; result: BiasResult; timestamp: number }> {
        return [...this.history];
    }

    resetStats(): void {
        this.stats = { scanned: 0, biasDetected: 0, byCategory: new Map() };
        this.history = [];
    }

    // ─── Private ─────────────────────────────────────────────────

    private scoreSeverity(score: number): BiasSeverity {
        if (score >= 0.7) return 'high';
        if (score >= 0.4) return 'medium';
        if (score >= 0.15) return 'low';
        return 'none';
    }

    private severityRank(s: BiasSeverity): number {
        return { none: 0, low: 1, medium: 2, high: 3 }[s];
    }

    private recordHistory(text: string, result: BiasResult): void {
        this.history.push({ text, result, timestamp: Date.now() });
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(-this.maxHistory);
        }
    }
}
