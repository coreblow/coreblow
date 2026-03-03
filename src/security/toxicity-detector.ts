/**
 * CoreBlow — Toxicity Detector
 *
 * Production-grade toxicity detection with multi-category scoring,
 * severity classification, context-aware analysis, custom dictionaries,
 * batch scanning, and configurable enforcement policies.
 */

import { clamp } from "../utils.js";
import { createChildLogger } from '../utils/logger.js';
import { testRegexWithBoundedInput, compileSafeRegexDetailed } from './safe-regex.js';

const log = createChildLogger('security:toxicity');

// ─── Types ───────────────────────────────────────────────────────

/** Toxicity category */
export type ToxicityCategory =
    | 'insult' | 'threat' | 'sexual' | 'hate_speech'
    | 'harassment' | 'spam' | 'violence' | 'self_harm'
    | 'dangerous_content';

/** Severity levels */
export type ToxicitySeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';

/** Toxicity result for a single scan */
export interface ToxicityResult {
    toxic: boolean;
    score: number;
    severity: ToxicitySeverity;
    categories: Array<{
        category: ToxicityCategory;
        score: number;
        severity: ToxicitySeverity;
        matched: string[];
    }>;
    explanation: string;
    context?: string;
}

/** Batch scan result */
export interface BatchToxicityResult {
    results: ToxicityResult[];
    totalToxic: number;
    averageScore: number;
    worstCategory?: ToxicityCategory;
}

/** Category definition */
interface CategoryDef {
    patterns: RegExp[];
    weight: number;
    severity: ToxicitySeverity;
    contextualBoost: number;
}

/** Toxicity detector configuration */
export interface ToxicityConfig {
    /** Detection threshold (0-1, default: 0.5) */
    threshold?: number;
    /** Categories to scan (default: all) */
    enabledCategories?: ToxicityCategory[];
    /** Context-aware scoring */
    contextAware?: boolean;
    /** Max text length to scan */
    maxTextLength?: number;
}

// ─── ToxicityDetector ────────────────────────────────────────────

/**
 * CoreBlow Toxicity Detector
 *
 * Scans text for toxic content across 9 categories with
 * weighted scoring, severity classification, and contextual analysis.
 */
export class ToxicityDetector {
    private categories: Map<ToxicityCategory, CategoryDef>;
    private customPatterns: Map<string, RegExp[]> = new Map();
    private allowlist: Set<string> = new Set();
    private threshold: number;
    private enabledCategories: Set<ToxicityCategory>;
    private contextAware: boolean;
    private maxTextLength: number;
    private stats = { scanned: 0, toxic: 0, byCategory: new Map<ToxicityCategory, number>() };
    private history: Array<{ text: string; result: ToxicityResult; timestamp: number }> = [];
    private maxHistory = 200;

    constructor(config?: ToxicityConfig) {
        this.threshold = config?.threshold ?? 0.5;
        this.contextAware = config?.contextAware ?? true;
        this.maxTextLength = config?.maxTextLength ?? 10000;
        this.enabledCategories = new Set(config?.enabledCategories ?? [
            'insult', 'threat', 'sexual', 'hate_speech', 'harassment',
            'spam', 'violence', 'self_harm', 'dangerous_content',
        ]);

        this.categories = new Map<ToxicityCategory, CategoryDef>([
            ['insult', {
                patterns: [
                    /\b(idiot|stupid|moron|dumb|loser|fool|incompetent|worthless|pathetic)\b/gi,
                ],
                weight: 1.0, severity: 'medium', contextualBoost: 0.1,
            }],
            ['threat', {
                patterns: [
                    /\b(kill\s+you|hurt\s+you|destroy\s+you|attack\s+you|find\s+you)\b/gi,
                    /\b(i\s+will\s+(?:kill|hurt|destroy|attack|find))\b/gi,
                ],
                weight: 1.0, severity: 'critical', contextualBoost: 0.2,
            }],
            ['sexual', {
                patterns: [
                    /\b(explicit\s+sexual\s+content)\b/gi,
                ],
                weight: 0.8, severity: 'high', contextualBoost: 0.1,
            }],
            ['hate_speech', {
                patterns: [
                    /\b(all\s+\w+\s+are\s+(?:stupid|evil|bad|inferior))\b/gi,
                ],
                weight: 1.0, severity: 'critical', contextualBoost: 0.3,
            }],
            ['harassment', {
                patterns: [
                    /\b(stalk|harass|bully|intimidate|torment|persecute)\b/gi,
                ],
                weight: 1.0, severity: 'high', contextualBoost: 0.15,
            }],
            ['spam', {
                patterns: [
                    /\b(buy\s+now|click\s+here|free\s+money|act\s+now|limited\s+offer|congratulations\s+you\s+won)\b/gi,
                ],
                weight: 0.5, severity: 'low', contextualBoost: 0.05,
            }],
            ['violence', {
                patterns: [
                    /\b(murder|torture|massacre|slaughter|bloodshed|dismember)\b/gi,
                ],
                weight: 0.9, severity: 'high', contextualBoost: 0.2,
            }],
            ['self_harm', {
                patterns: [
                    /\b(suicide|self.?harm|cut\s+myself|end\s+my\s+life|kill\s+myself)\b/gi,
                ],
                weight: 1.0, severity: 'critical', contextualBoost: 0.3,
            }],
            ['dangerous_content', {
                patterns: [
                    /\b(how\s+to\s+make\s+(?:a\s+)?(?:bomb|weapon|poison|drug))\b/gi,
                    /\b(instructions\s+for\s+(?:harm|illegal|criminal))\b/gi,
                ],
                weight: 1.0, severity: 'critical', contextualBoost: 0.3,
            }],
        ]);
    }

    // ─── Analysis ────────────────────────────────────────────────

    /**
     * Analyze text for toxicity.
     */
    analyze(text: string): ToxicityResult {
        this.stats.scanned++;
        const truncated = text.slice(0, this.maxTextLength);
        const lowerText = truncated.toLowerCase();

        // Check allowlist
        if (this.isAllowlisted(lowerText)) {
            return this.safeResult();
        }

        const categoryResults: ToxicityResult['categories'] = [];
        let maxScore = 0;
        let highestSeverity: ToxicitySeverity = 'none';

        for (const [cat, def] of this.categories) {
            if (!this.enabledCategories.has(cat)) continue;

            const matched: string[] = [];
            const allPatterns = [...def.patterns, ...(this.customPatterns.get(cat) ?? [])];

            for (const pattern of allPatterns) {
                const re = new RegExp(pattern.source, pattern.flags);
                // Use bounded input testing to prevent O(n) on long strings (ReDoS mitigation)
                const matches = testRegexWithBoundedInput(re, truncated)
                    ? truncated.match(re)
                    : null;
                if (matches) matched.push(...matches.map((m) => m.trim()));
            }

            if (matched.length > 0) {
                let score = Math.min(1, matched.length * def.weight * 0.5);

                // Context boost: repeated offenses in same text increase score
                if (this.contextAware && matched.length > 2) {
                    score = Math.min(1, score + def.contextualBoost * (matched.length - 2));
                }

                const catSeverity = this.scoreSeverity(score, def.severity);
                categoryResults.push({ category: cat, score, severity: catSeverity, matched: [...new Set(matched)] });
                maxScore = Math.max(maxScore, score);

                if (this.severityRank(catSeverity) > this.severityRank(highestSeverity)) {
                    highestSeverity = catSeverity;
                }

                // Track stats
                this.stats.byCategory.set(cat, (this.stats.byCategory.get(cat) ?? 0) + 1);
            }
        }

        const toxic = maxScore >= this.threshold;
        if (toxic) this.stats.toxic++;

        const severity = toxic ? highestSeverity : 'none';
        const topCats = categoryResults
            .filter((c) => c.score > 0)
            .sort((a, b) => b.score - a.score)
            .map((c) => c.category);

        const result: ToxicityResult = {
            toxic,
            score: maxScore,
            severity,
            categories: categoryResults,
            explanation: toxic
                ? `Toxic content detected (${severity}): ${topCats.join(', ')}`
                : 'Content appears safe',
        };

        this.recordHistory(truncated.slice(0, 100), result);
        return result;
    }

    /**
     * Batch scan multiple texts.
     */
    analyzeBatch(texts: string[]): BatchToxicityResult {
        const results = texts.map((t) => this.analyze(t));
        const totalToxic = results.filter((r) => r.toxic).length;
        const averageScore = results.length > 0
            ? results.reduce((s, r) => s + r.score, 0) / results.length
            : 0;

        // Find worst category
        const catCounts = new Map<ToxicityCategory, number>();
        for (const r of results) {
            for (const c of r.categories) {
                catCounts.set(c.category, (catCounts.get(c.category) ?? 0) + 1);
            }
        }
        let worstCategory: ToxicityCategory | undefined;
        let worstCount = 0;
        for (const [cat, count] of catCounts) {
            if (count > worstCount) { worstCategory = cat; worstCount = count; }
        }

        return { results, totalToxic, averageScore, worstCategory };
    }

    /**
     * Quick check — returns just true/false for performance.
     */
    isToxic(text: string): boolean {
        return this.analyze(text).toxic;
    }

    // ─── Configuration ───────────────────────────────────────────

    setThreshold(threshold: number): void {
        this.threshold = clamp(threshold, 0, 1);
    }

    getThreshold(): number { return this.threshold; }

    enableCategory(cat: ToxicityCategory): void { this.enabledCategories.add(cat); }
    disableCategory(cat: ToxicityCategory): void { this.enabledCategories.delete(cat); }
    getEnabledCategories(): ToxicityCategory[] { return Array.from(this.enabledCategories); }

    /**
     * Add custom patterns to a category.
     * Validates pattern safety (ReDoS protection) before adding.
     * User-supplied patterns are checked via `compileSafeRegexDetailed`.
     */
    addCustomPattern(category: ToxicityCategory, pattern: RegExp): void {
        // Validate pattern safety if it looks like it came from user input
        const check = compileSafeRegexDetailed(pattern.source, pattern.flags);
        if (check.reason === 'unsafe-nested-repetition') {
            log.warn({ source: pattern.source }, 'Rejected custom toxicity pattern: unsafe nested repetition (ReDoS risk)');
            return;
        }
        if (!this.customPatterns.has(category)) this.customPatterns.set(category, []);
        this.customPatterns.get(category)!.push(pattern);
    }

    /**
     * Add a term to the allowlist (won't trigger detection).
     */
    addToAllowlist(term: string): void { this.allowlist.add(term.toLowerCase()); }

    // ─── Statistics ──────────────────────────────────────────────

    getStats(): { scanned: number; toxic: number; toxicRate: number; byCategory: Record<string, number> } {
        const byCategory: Record<string, number> = {};
        for (const [cat, count] of this.stats.byCategory) byCategory[cat] = count;
        return {
            scanned: this.stats.scanned,
            toxic: this.stats.toxic,
            toxicRate: this.stats.scanned > 0 ? this.stats.toxic / this.stats.scanned : 0,
            byCategory,
        };
    }

    getHistory(): Array<{ text: string; result: ToxicityResult; timestamp: number }> {
        return [...this.history];
    }

    resetStats(): void {
        this.stats = { scanned: 0, toxic: 0, byCategory: new Map() };
        this.history = [];
    }

    // ─── Private ─────────────────────────────────────────────────

    private safeResult(): ToxicityResult {
        return { toxic: false, score: 0, severity: 'none', categories: [], explanation: 'Content appears safe' };
    }

    private isAllowlisted(text: string): boolean {
        for (const term of this.allowlist) {
            if (text.includes(term)) return false; // allowlist items override
        }
        return false;
    }

    private scoreSeverity(score: number, baseSeverity: ToxicitySeverity): ToxicitySeverity {
        if (score >= 0.9) return 'critical';
        if (score >= 0.7) return baseSeverity === 'critical' ? 'critical' : 'high';
        if (score >= 0.4) return this.severityRank(baseSeverity) >= 3 ? baseSeverity : 'medium';
        if (score >= 0.2) return 'low';
        return 'none';
    }

    private severityRank(s: ToxicitySeverity): number {
        return { none: 0, low: 1, medium: 2, high: 3, critical: 4 }[s];
    }

    private recordHistory(text: string, result: ToxicityResult): void {
        this.history.push({ text, result, timestamp: Date.now() });
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(-this.maxHistory);
        }
    }
}
