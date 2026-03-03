/**
 * security/guardrails.ts
 *
 * Unified Guardrails Engine — orchestrates all safety checks
 * (content filter, toxicity, PII, bias) into a single pipeline
 * with configurable enforcement policies and safety reports.
 */

import { createChildLogger } from '../utils/logger.js';
import { ToxicityDetector, type ToxicityResult, type ToxicityConfig } from './toxicity-detector.js';
import { BiasDetector, type BiasResult, type BiasConfig } from './bias-detector.js';
import { PIIScanner, type PIIScanResult } from './pii-scanner.js';
import { ContentFilter, type FilterResult } from './content-filter.js';
import { SafetyReport, type SafetyCheck, type SafetyReportData } from './safety-report.js';

const log = createChildLogger('security:guardrails');

// ─── Types ───────────────────────────────────────────────────────

/** Guardrails enforcement policy */
export type EnforcementPolicy = 'strict' | 'standard' | 'permissive' | 'monitor';

/** Guardrails configuration */
export interface GuardrailsConfig {
    policy?: EnforcementPolicy;
    toxicity?: ToxicityConfig & { enabled?: boolean };
    bias?: BiasConfig & { enabled?: boolean };
    pii?: { enabled?: boolean; mask?: boolean };
    content?: { enabled?: boolean };
}

/** Complete scan result from all guardrails */
export interface GuardrailsScanResult {
    safe: boolean;
    blocked: boolean;
    policy: EnforcementPolicy;
    text: string;
    filteredText?: string;
    toxicity?: ToxicityResult;
    bias?: BiasResult;
    pii?: PIIScanResult;
    content?: FilterResult;
    report: SafetyReportData;
    enforcements: string[];
}

// ─── Policy Presets ──────────────────────────────────────────────

const POLICY_PRESETS: Record<EnforcementPolicy, {
    toxicityThreshold: number;
    biasThreshold: number;
    blockOnToxic: boolean;
    blockOnBias: boolean;
    blockOnPII: boolean;
    maskPII: boolean;
    blockOnContent: boolean;
}> = {
    strict: {
        toxicityThreshold: 0.3,
        biasThreshold: 0.3,
        blockOnToxic: true,
        blockOnBias: true,
        blockOnPII: true,
        maskPII: true,
        blockOnContent: true,
    },
    standard: {
        toxicityThreshold: 0.5,
        biasThreshold: 0.4,
        blockOnToxic: true,
        blockOnBias: false,
        blockOnPII: false,
        maskPII: true,
        blockOnContent: true,
    },
    permissive: {
        toxicityThreshold: 0.7,
        biasThreshold: 0.6,
        blockOnToxic: false,
        blockOnBias: false,
        blockOnPII: false,
        maskPII: true,
        blockOnContent: false,
    },
    monitor: {
        toxicityThreshold: 0.5,
        biasThreshold: 0.4,
        blockOnToxic: false,
        blockOnBias: false,
        blockOnPII: false,
        maskPII: false,
        blockOnContent: false,
    },
};

// ─── GuardrailsEngine ────────────────────────────────────────────

/**
 * CoreBlow Guardrails Engine
 *
 * Unified safety pipeline orchestrating toxicity detection,
 * bias detection, PII scanning, and content filtering with
 * configurable enforcement policies.
 */
export class GuardrailsEngine {
    private toxicity: ToxicityDetector;
    private bias: BiasDetector;
    private pii: PIIScanner;
    private contentFilter: ContentFilter;
    private safetyReport: SafetyReport;
    private policy: EnforcementPolicy;
    private enabledChecks: {
        toxicity: boolean;
        bias: boolean;
        pii: boolean;
        content: boolean;
    };
    private stats = { scans: 0, blocked: 0, warnings: 0 };

    constructor(config?: GuardrailsConfig) {
        this.policy = config?.policy ?? 'standard';
        const preset = POLICY_PRESETS[this.policy];

        this.toxicity = new ToxicityDetector({
            threshold: config?.toxicity?.threshold ?? preset.toxicityThreshold,
            ...config?.toxicity,
        });

        this.bias = new BiasDetector({
            threshold: config?.bias?.threshold ?? preset.biasThreshold,
            ...config?.bias,
        });

        this.pii = new PIIScanner();
        this.contentFilter = new ContentFilter();
        this.safetyReport = new SafetyReport();

        this.enabledChecks = {
            toxicity: config?.toxicity?.enabled ?? true,
            bias: config?.bias?.enabled ?? true,
            pii: config?.pii?.enabled ?? true,
            content: config?.content?.enabled ?? true,
        };
    }

    // ─── Scanning ────────────────────────────────────────────────

    /**
     * Run all guardrails on input text.
     */
    scan(text: string): GuardrailsScanResult {
        this.stats.scans++;
        const preset = POLICY_PRESETS[this.policy];
        const checks: SafetyCheck[] = [];
        const enforcements: string[] = [];
        let blocked = false;
        let filteredText: string | undefined;

        // 1. Toxicity check
        let toxicityResult: ToxicityResult | undefined;
        if (this.enabledChecks.toxicity) {
            toxicityResult = this.toxicity.analyze(text);
            checks.push({
                name: 'toxicity',
                passed: !toxicityResult.toxic,
                score: 1 - toxicityResult.score,
                details: toxicityResult.explanation,
                severity: toxicityResult.toxic
                    ? (toxicityResult.severity === 'critical' ? 'critical' : toxicityResult.severity === 'high' ? 'high' : 'medium')
                    : 'safe',
            });

            if (toxicityResult.toxic && preset.blockOnToxic) {
                blocked = true;
                enforcements.push(`Blocked: toxic content (${toxicityResult.severity})`);
            }
        }

        // 2. Content filter check
        let contentResult: FilterResult | undefined;
        if (this.enabledChecks.content) {
            contentResult = this.contentFilter.scan(text);
            checks.push({
                name: 'content-filter',
                passed: contentResult.passed,
                score: contentResult.passed ? 1 : 0,
                details: contentResult.violations.length > 0
                    ? `${contentResult.violations.length} violation(s): ${contentResult.violations.map((v) => v.category).join(', ')}`
                    : 'Clean',
                severity: contentResult.passed ? 'safe'
                    : contentResult.violations.some((v) => v.severity === 'critical') ? 'critical'
                    : contentResult.violations.some((v) => v.severity === 'high') ? 'high' : 'medium',
            });

            if (!contentResult.passed && preset.blockOnContent) {
                blocked = true;
                enforcements.push('Blocked: content filter violation');
            }
            if (contentResult.filteredContent) {
                filteredText = contentResult.filteredContent;
            }
        }

        // 3. PII check
        let piiResult: PIIScanResult | undefined;
        if (this.enabledChecks.pii) {
            piiResult = this.pii.scan(text);
            checks.push({
                name: 'pii',
                passed: !piiResult.hasPII,
                score: piiResult.hasPII ? 0.5 : 1,
                details: piiResult.hasPII
                    ? `${piiResult.piiCount} PII item(s) found: ${piiResult.matches.map((m) => m.type).join(', ')}`
                    : 'No PII detected',
                severity: piiResult.hasPII ? 'medium' : 'safe',
            });

            if (piiResult.hasPII) {
                if (preset.blockOnPII) {
                    blocked = true;
                    enforcements.push('Blocked: PII detected');
                }
                if (preset.maskPII) {
                    filteredText = piiResult.maskedText;
                    enforcements.push('PII masked in output');
                }
            }
        }

        // 4. Bias check
        let biasResult: BiasResult | undefined;
        if (this.enabledChecks.bias) {
            biasResult = this.bias.analyze(text);
            checks.push({
                name: 'bias',
                passed: !biasResult.biased,
                score: 1 - biasResult.overallScore,
                details: biasResult.recommendation,
                severity: biasResult.biased
                    ? (biasResult.severity === 'high' ? 'high' : 'medium')
                    : 'safe',
            });

            if (biasResult.biased && preset.blockOnBias) {
                blocked = true;
                enforcements.push('Blocked: bias detected');
            }
        }

        // Generate report
        const report = this.safetyReport.generate(text, checks);

        if (blocked) this.stats.blocked++;
        if (!blocked && checks.some((c) => !c.passed)) this.stats.warnings++;

        const safe = checks.every((c) => c.passed);

        return {
            safe,
            blocked,
            policy: this.policy,
            text: text.slice(0, 200),
            filteredText,
            toxicity: toxicityResult,
            bias: biasResult,
            pii: piiResult,
            content: contentResult,
            report,
            enforcements,
        };
    }

    /**
     * Quick safe check — returns just true/false.
     */
    isSafe(text: string): boolean {
        return this.scan(text).safe;
    }

    /**
     * Batch scan multiple texts.
     */
    scanBatch(texts: string[]): GuardrailsScanResult[] {
        return texts.map((t) => this.scan(t));
    }

    // ─── Configuration ───────────────────────────────────────────

    setPolicy(policy: EnforcementPolicy): void {
        this.policy = policy;
        const preset = POLICY_PRESETS[policy];
        this.toxicity.setThreshold(preset.toxicityThreshold);
        this.bias.setThreshold(preset.biasThreshold);
    }

    getPolicy(): EnforcementPolicy { return this.policy; }

    enableCheck(check: 'toxicity' | 'bias' | 'pii' | 'content'): void {
        this.enabledChecks[check] = true;
    }

    disableCheck(check: 'toxicity' | 'bias' | 'pii' | 'content'): void {
        this.enabledChecks[check] = false;
    }

    getEnabledChecks(): Record<string, boolean> { return { ...this.enabledChecks }; }

    // ─── Statistics ──────────────────────────────────────────────

    getStats(): {
        scans: number;
        blocked: number;
        warnings: number;
        blockRate: number;
        toxicity: ReturnType<ToxicityDetector['getStats']>;
        bias: ReturnType<BiasDetector['getStats']>;
        pii: ReturnType<PIIScanner['getStats']>;
        contentFilter: ReturnType<ContentFilter['getStats']>;
        safetyReports: ReturnType<SafetyReport['getStats']>;
    } {
        return {
            ...this.stats,
            blockRate: this.stats.scans > 0 ? this.stats.blocked / this.stats.scans : 0,
            toxicity: this.toxicity.getStats(),
            bias: this.bias.getStats(),
            pii: this.pii.getStats(),
            contentFilter: this.contentFilter.getStats(),
            safetyReports: this.safetyReport.getStats(),
        };
    }

    getRecentReports(limit?: number): SafetyReportData[] {
        return this.safetyReport.getRecent(limit);
    }

    // ─── Accessors for Testing ───────────────────────────────────

    getToxicity(): ToxicityDetector { return this.toxicity; }
    getBias(): BiasDetector { return this.bias; }
    getPII(): PIIScanner { return this.pii; }
    getContentFilter(): ContentFilter { return this.contentFilter; }
}
