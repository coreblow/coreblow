/**
 * CoreBlow Phase 31 — Content Ingress Safety Pipeline Chain Tests
 *
 * Layer 2 (Pipeline):
 *   ContentFilter.scan → PIIScanner.scan → ToxicityDetector.analyze
 *   → BiasDetector.analyze → SafetyReport.generate
 *
 * Simulates the production content processing flow where user input
 * passes through all safety checks before reaching the AI model.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ContentFilter } from '../../src/security/content-filter.js';
import { PIIScanner } from '../../src/security/pii-scanner.js';
import { ToxicityDetector } from '../../src/security/toxicity-detector.js';
import { BiasDetector } from '../../src/security/bias-detector.js';
import { SafetyReport, type SafetyCheck } from '../../src/security/safety-report.js';

describe('Phase31 Chain: Content Ingress Safety Pipeline', () => {
    let contentFilter: ContentFilter;
    let piiScanner: PIIScanner;
    let toxicity: ToxicityDetector;
    let bias: BiasDetector;
    let safetyReport: SafetyReport;

    beforeEach(() => {
        contentFilter = new ContentFilter();
        piiScanner = new PIIScanner();
        toxicity = new ToxicityDetector();
        bias = new BiasDetector();
        safetyReport = new SafetyReport();
    });

    /**
     * Helper: run full safety pipeline on input text
     */
    function runPipeline(text: string) {
        const checks: SafetyCheck[] = [];

        // Step 1: Content filter
        const filterResult = contentFilter.scan(text);
        checks.push({
            name: 'content-filter',
            passed: filterResult.passed,
            score: filterResult.passed ? 1 : 0,
            details: filterResult.violations.map(v => `${v.category}:${v.match}`).join(', ') || 'Clean',
            severity: filterResult.passed ? 'safe' : (filterResult.violations.some(v => v.severity === 'critical') ? 'critical' : 'high'),
        });

        // Step 2: PII scan
        const piiResult = piiScanner.scan(text);
        checks.push({
            name: 'pii-scan',
            passed: !piiResult.hasPII,
            score: piiResult.hasPII ? 0.3 : 1,
            details: piiResult.hasPII ? `Found: ${piiResult.matches.map(m => m.type).join(', ')}` : 'No PII',
            severity: piiResult.hasPII ? 'high' : 'safe',
        });

        // Step 3: Toxicity check
        const toxResult = toxicity.analyze(text);
        checks.push({
            name: 'toxicity',
            passed: !toxResult.toxic,
            score: 1 - toxResult.score,
            details: toxResult.explanation,
            severity: toxResult.toxic ? (toxResult.severity === 'critical' ? 'critical' : 'high') : 'safe',
        });

        // Step 4: Bias check
        const biasResult = bias.analyze(text);
        checks.push({
            name: 'bias',
            passed: !biasResult.biased,
            score: 1 - biasResult.overallScore,
            details: biasResult.recommendation,
            severity: biasResult.biased ? 'medium' : 'safe',
        });

        // Step 5: Generate safety report
        return safetyReport.generate(text, checks);
    }

    // ── Clean Content ──

    it('clean text passes all 4 safety checks', () => {
        const report = runPipeline('Hello, how can I help you today?');
        expect(report.overallSafe).toBe(true);
        expect(report.checks.every(c => c.passed)).toBe(true);
        expect(report.recommendation).toContain('passes all');
    });

    // ── Single Check Failures ──

    it('PII detected → report marked unsafe with PII details', () => {
        const report = runPipeline('My email is john@example.com and SSN is 123-45-6789');
        expect(report.overallSafe).toBe(false);
        const piiCheck = report.checks.find(c => c.name === 'pii-scan')!;
        expect(piiCheck.passed).toBe(false);
        expect(piiCheck.details).toContain('email');
        expect(piiCheck.details).toContain('ssn');
    });

    it('toxic content → report marked unsafe with toxicity details', () => {
        const report = runPipeline('You are such an idiot and a moron and stupid and dumb');
        expect(report.overallSafe).toBe(false);
        const toxCheck = report.checks.find(c => c.name === 'toxicity')!;
        expect(toxCheck.passed).toBe(false);
    });

    it('threat detected → critical block', () => {
        const report = runPipeline('I will murder and kill the process');
        expect(report.overallSafe).toBe(false);
        const filterCheck = report.checks.find(c => c.name === 'content-filter')!;
        expect(filterCheck.passed).toBe(false);
    });

    // ── Multi-Failure ──

    it('combined violations: PII + toxicity → report captures both', () => {
        const report = runPipeline('You stupid idiot moron email john@example.com');
        expect(report.overallSafe).toBe(false);

        const failed = report.checks.filter(c => !c.passed);
        expect(failed.length).toBeGreaterThanOrEqual(2);
    });

    it('all checks fail on maximally unsafe content', () => {
        const report = runPipeline('The chairman will attack john@example.com you stupid idiot moron');
        expect(report.overallSafe).toBe(false);

        // At minimum: content-filter (attack=threat), pii (email), toxicity (insults)
        const failedChecks = report.checks.filter(c => !c.passed);
        expect(failedChecks.length).toBeGreaterThanOrEqual(3);
    });
});
