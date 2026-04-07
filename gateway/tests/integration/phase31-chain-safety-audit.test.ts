/**
 * CoreBlow Phase 31 — Safety Audit Pipeline Chain Tests
 *
 * Layer 2 (Pipeline):
 *   Multi-round conversation audit:
 *     ToxicityDetector.analyzeBatch → BiasDetector.analyzeBatch
 *     → SafetyReport (per-round) → Aggregate telemetry
 *
 * Simulates auditing an entire conversation or batch of AI outputs.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ToxicityDetector } from '../../src/security/toxicity-detector.js';
import { BiasDetector } from '../../src/security/bias-detector.js';
import { SafetyReport, type SafetyCheck } from '../../src/security/safety-report.js';
import { PIIScanner } from '../../src/security/pii-scanner.js';
import { EventStore } from '../../src/infra/event-sourcing.js';

describe('Phase31 Chain: Safety Audit Pipeline', () => {
    let toxicity: ToxicityDetector;
    let bias: BiasDetector;
    let report: SafetyReport;
    let pii: PIIScanner;
    let audit: EventStore;

    beforeEach(() => {
        toxicity = new ToxicityDetector();
        bias = new BiasDetector();
        report = new SafetyReport();
        pii = new PIIScanner();
        audit = new EventStore();
    });

    it('conversation audit: scan 5 rounds → batch stats correct', () => {
        const conversation = [
            'Hello, I need help with my project',
            'Sure, I can help with that. What do you need?',
            'Can you explain machine learning?',
            'Machine learning is a branch of AI...',
            'Thank you, that was helpful!',
        ];

        // Batch scan for toxicity
        const toxResult = toxicity.analyzeBatch(conversation);
        expect(toxResult.totalToxic).toBe(0);
        expect(toxResult.averageScore).toBeLessThan(0.5);

        // Batch scan for bias
        const biasResult = bias.analyzeBatch(conversation);
        expect(biasResult.totalBiased).toBe(0);

        // Generate per-round reports
        for (const msg of conversation) {
            const checks: SafetyCheck[] = [
                { name: 'toxicity', passed: true, score: 1, details: 'OK', severity: 'safe' },
                { name: 'bias', passed: true, score: 1, details: 'OK', severity: 'safe' },
            ];
            report.generate(msg, checks);
        }

        const stats = report.getStats();
        expect(stats.total).toBe(5);
        expect(stats.safe).toBe(5);
        expect(stats.safeRate).toBe(1);
    });

    it('mixed conversation: 1 toxic turn → detected in batch', () => {
        const conversation = [
            'Hello, how are you?',
            'You are an idiot and a moron and stupid and dumb',
            'Sorry about that. How can I help?',
        ];

        const toxResult = toxicity.analyzeBatch(conversation);
        expect(toxResult.totalToxic).toBe(1);
        expect(toxResult.worstCategory).toBe('insult');

        // Log to audit trail
        for (let i = 0; i < conversation.length; i++) {
            const isClean = !toxResult.results[i]!.toxic;
            audit.append(
                isClean ? 'safety:pass' : 'safety:fail',
                'conversation-1',
                { turn: i, toxic: toxResult.results[i]!.toxic },
            );
        }

        const safetyEvents = audit.getEvents('conversation-1');
        expect(safetyEvents).toHaveLength(3);
        expect(safetyEvents.filter(e => e.type === 'safety:fail')).toHaveLength(1);
    });

    it('PII pipeline: detect → mask → verify masked output is clean', () => {
        const input = 'Contact me at alice@example.com, my SSN is 123-45-6789';

        // Step 1: Detect PII
        const scanResult = pii.scan(input);
        expect(scanResult.hasPII).toBe(true);
        expect(scanResult.piiCount).toBe(2);

        // Step 2: Get masked version
        const maskedText = scanResult.maskedText;

        // Step 3: Re-scan masked version — should be clean
        const rescan = pii.scan(maskedText);
        expect(rescan.hasPII).toBe(false);

        // Step 4: Log audit event
        audit.append('pii:detected', 'session-1', {
            types: scanResult.matches.map(m => m.type),
            count: scanResult.piiCount,
            maskedSuccessfully: !rescan.hasPII,
        });

        const events = audit.getEvents('session-1');
        expect(events[0]!.payload.maskedSuccessfully).toBe(true);
    });

    it('safety telemetry: aggregate stats across all subsystems', () => {
        // Run various scans
        toxicity.analyze('Hello');
        toxicity.analyze('You idiot moron stupid dumb');
        bias.analyze('The chairman decided');
        bias.analyze('The weather is nice');
        pii.scan('Email: a@b.com');
        pii.scan('No PII here');

        report.generate('a', [{ name: 'x', passed: true, score: 1, details: '', severity: 'safe' }]);
        report.generate('b', [{ name: 'x', passed: false, score: 0, details: '', severity: 'high' }]);

        // Aggregate telemetry
        const telemetry = {
            toxicity: toxicity.getStats(),
            bias: bias.getStats(),
            pii: pii.getStats(),
            reports: report.getStats(),
        };

        expect(telemetry.toxicity.scanned).toBe(2);
        expect(telemetry.toxicity.toxic).toBe(1);
        expect(telemetry.bias.scanned).toBe(2);
        expect(telemetry.pii.scanned).toBe(2);
        expect(telemetry.pii.piiFound).toBe(1);
        expect(telemetry.reports.total).toBe(2);
        expect(telemetry.reports.safe).toBe(1);
    });
});
