import { describe, it, expect, beforeEach } from 'vitest';
import { PIIScanner } from './pii-scanner.js';
import type { PIIScanResult, PIIMatch, PIIType } from './pii-scanner.js';

describe('PIIScanner', () => {
    let scanner: PIIScanner;

    beforeEach(() => {
        scanner = new PIIScanner();
    });

    // ───────────────────────────────────────────────────────
    // 1. Initialization
    // ───────────────────────────────────────────────────────

    describe('initialization', () => {
        it('should have 5 built-in pattern types', () => {
            expect(scanner.count()).toBe(5);
        });

        it('should list all built-in types', () => {
            const types = scanner.listTypes();
            expect(types).toEqual(['email', 'phone', 'ssn', 'credit_card', 'ip_address']);
        });

        it('should start with zero stats', () => {
            const stats = scanner.getStats();
            expect(stats.scanned).toBe(0);
            expect(stats.piiFound).toBe(0);
        });
    });

    // ───────────────────────────────────────────────────────
    // 2. Clean Text — No PII (Happy Path)
    // ───────────────────────────────────────────────────────

    describe('clean text — no PII', () => {
        it('should return hasPII=false for plain text', () => {
            const result = scanner.scan('Hello, this is a normal message.');
            expect(result.hasPII).toBe(false);
            expect(result.matches).toHaveLength(0);
            expect(result.piiCount).toBe(0);
            expect(result.maskedText).toBe('Hello, this is a normal message.');
        });

        it('should return hasPII=false for empty string', () => {
            const result = scanner.scan('');
            expect(result.hasPII).toBe(false);
            expect(result.matches).toHaveLength(0);
            expect(result.maskedText).toBe('');
        });

        it('should return hasPII=false for text with numbers that are not PII', () => {
            const result = scanner.scan('Order #12345 was placed on 2024-01-15');
            expect(result.hasPII).toBe(false);
        });

        it('should return hasPII=false for text with @ but not a valid email', () => {
            const result = scanner.scan('Use @mention to tag someone');
            expect(result.hasPII).toBe(false);
        });
    });

    // ───────────────────────────────────────────────────────
    // 3. Email Detection & Masking
    // ───────────────────────────────────────────────────────

    describe('email detection', () => {
        it('should detect a standard email', () => {
            const result = scanner.scan('Contact me at john.doe@example.com please');
            expect(result.hasPII).toBe(true);
            expect(result.piiCount).toBe(1);
            expect(result.matches[0].type).toBe('email');
            expect(result.matches[0].value).toBe('john.doe@example.com');
        });

        it('should mask email keeping first 2 chars and domain', () => {
            const result = scanner.scan('Email: john.doe@example.com');
            expect(result.matches[0].masked).toBe('jo***@example.com');
            expect(result.maskedText).toContain('jo***@example.com');
            expect(result.maskedText).not.toContain('john.doe@example.com');
        });

        it('should detect email with + addressing', () => {
            const result = scanner.scan('Send to user+tag@gmail.com');
            expect(result.hasPII).toBe(true);
            expect(result.matches[0].value).toBe('user+tag@gmail.com');
        });

        it('should detect email with % character', () => {
            const result = scanner.scan('Email test%user@domain.org');
            expect(result.hasPII).toBe(true);
            expect(result.matches[0].value).toBe('test%user@domain.org');
        });

        it('should detect email with subdomain', () => {
            const result = scanner.scan('Send to admin@mail.server.co.uk');
            expect(result.hasPII).toBe(true);
            expect(result.matches[0].type).toBe('email');
        });

        it('should detect multiple emails in one text', () => {
            const result = scanner.scan('CC: alice@a.com and bob@b.com');
            expect(result.piiCount).toBe(2);
            expect(result.matches[0].value).toBe('alice@a.com');
            expect(result.matches[1].value).toBe('bob@b.com');
        });

        it('should record correct startIndex and endIndex for email', () => {
            const text = 'Hi test@example.com bye';
            const result = scanner.scan(text);
            const match = result.matches[0];
            expect(match.startIndex).toBe(3);
            expect(match.endIndex).toBe(19);
            expect(text.substring(match.startIndex, match.endIndex)).toBe('test@example.com');
        });
    });

    // ───────────────────────────────────────────────────────
    // 4. Phone Number Detection & Masking
    // ───────────────────────────────────────────────────────

    describe('phone detection', () => {
        it('should detect phone with parentheses: (555) 123-4567', () => {
            const result = scanner.scan('Call (555) 123-4567');
            expect(result.hasPII).toBe(true);
            expect(result.matches.some((m) => m.type === 'phone')).toBe(true);
        });

        it('should detect phone with dashes: 555-123-4567', () => {
            const result = scanner.scan('Phone: 555-123-4567');
            expect(result.hasPII).toBe(true);
            expect(result.matches.some((m) => m.type === 'phone')).toBe(true);
        });

        it('should detect phone with dots: 555.123.4567', () => {
            const result = scanner.scan('Phone: 555.123.4567');
            expect(result.hasPII).toBe(true);
            expect(result.matches.some((m) => m.type === 'phone')).toBe(true);
        });

        it('should detect phone with spaces: 555 123 4567', () => {
            const result = scanner.scan('Tel 555 123 4567');
            expect(result.hasPII).toBe(true);
            expect(result.matches.some((m) => m.type === 'phone')).toBe(true);
        });

        it('should detect phone with country code: +1-555-123-4567', () => {
            const result = scanner.scan('Call +1-555-123-4567');
            expect(result.hasPII).toBe(true);
            expect(result.matches.some((m) => m.type === 'phone')).toBe(true);
        });

        it('should mask phone keeping first 3 and last 2 characters', () => {
            const result = scanner.scan('Phone: 555-123-4567');
            const phone = result.matches.find((m) => m.type === 'phone');
            expect(phone).toBeDefined();
            const val = phone!.value;
            const expected = val.slice(0, 3) + '***' + val.slice(-2);
            expect(phone!.masked).toBe(expected);
        });

        it('should replace phone in maskedText', () => {
            const result = scanner.scan('Call me at 555-123-4567 please');
            expect(result.maskedText).not.toContain('555-123-4567');
        });
    });

    // ───────────────────────────────────────────────────────
    // 5. SSN Detection & Masking
    // ───────────────────────────────────────────────────────

    describe('SSN detection', () => {
        it('should detect SSN in standard format: 123-45-6789', () => {
            const result = scanner.scan('SSN: 123-45-6789');
            expect(result.hasPII).toBe(true);
            expect(result.matches.some((m) => m.type === 'ssn')).toBe(true);
            const ssn = result.matches.find((m) => m.type === 'ssn')!;
            expect(ssn.value).toBe('123-45-6789');
        });

        it('should mask SSN to ***-**-****', () => {
            const result = scanner.scan('SSN: 123-45-6789');
            const ssn = result.matches.find((m) => m.type === 'ssn')!;
            expect(ssn.masked).toBe('***-**-****');
        });

        it('should replace SSN in maskedText', () => {
            const result = scanner.scan('My SSN is 987-65-4321 for records');
            expect(result.maskedText).toContain('***-**-****');
            expect(result.maskedText).not.toContain('987-65-4321');
        });

        it('should detect multiple SSNs', () => {
            const result = scanner.scan('SSN1: 111-22-3333 SSN2: 444-55-6666');
            const ssns = result.matches.filter((m) => m.type === 'ssn');
            expect(ssns).toHaveLength(2);
        });

        it('should NOT detect SSN without dashes: 123456789', () => {
            const result = scanner.scan('Number 123456789 is not an SSN');
            const ssns = result.matches.filter((m) => m.type === 'ssn');
            expect(ssns).toHaveLength(0);
        });
    });

    // ───────────────────────────────────────────────────────
    // 6. Credit Card Detection & Masking
    // ───────────────────────────────────────────────────────

    describe('credit card detection', () => {
        it('should detect CC with dashes: 4111-1111-1111-1111', () => {
            const result = scanner.scan('Card: 4111-1111-1111-1111');
            expect(result.hasPII).toBe(true);
            const cc = result.matches.find((m) => m.type === 'credit_card');
            expect(cc).toBeDefined();
            expect(cc!.value).toBe('4111-1111-1111-1111');
        });

        it('should detect CC with spaces: 4111 1111 1111 1111', () => {
            const result = scanner.scan('Card: 4111 1111 1111 1111');
            expect(result.hasPII).toBe(true);
            expect(result.matches.some((m) => m.type === 'credit_card')).toBe(true);
        });

        it('should detect CC without separators: 4111111111111111', () => {
            const result = scanner.scan('Card: 4111111111111111');
            expect(result.hasPII).toBe(true);
            expect(result.matches.some((m) => m.type === 'credit_card')).toBe(true);
        });

        it('should mask CC showing only last 4 digits', () => {
            const result = scanner.scan('Card: 4111-1111-1111-1234');
            const cc = result.matches.find((m) => m.type === 'credit_card')!;
            expect(cc.masked).toBe('****-****-****-1234');
        });

        it('should mask CC without separators showing last 4', () => {
            const result = scanner.scan('Card: 5500000000005678');
            const cc = result.matches.find((m) => m.type === 'credit_card')!;
            expect(cc.masked).toBe('****-****-****-5678');
        });

        it('should replace CC in maskedText', () => {
            const result = scanner.scan('Pay with 4111-1111-1111-1111 on file');
            expect(result.maskedText).not.toContain('4111-1111-1111-1111');
            expect(result.maskedText).toContain('****-****-****-1111');
        });
    });

    // ───────────────────────────────────────────────────────
    // 7. IP Address Detection & Masking
    // ───────────────────────────────────────────────────────

    describe('IP address detection', () => {
        it('should detect standard IPv4: 192.168.1.100', () => {
            const result = scanner.scan('Server at 192.168.1.100 is down');
            expect(result.hasPII).toBe(true);
            const ip = result.matches.find((m) => m.type === 'ip_address');
            expect(ip).toBeDefined();
            expect(ip!.value).toBe('192.168.1.100');
        });

        it('should detect loopback: 127.0.0.1', () => {
            const result = scanner.scan('Localhost: 127.0.0.1');
            expect(result.hasPII).toBe(true);
            expect(result.matches.some((m) => m.type === 'ip_address')).toBe(true);
        });

        it('should mask IP replacing last octet with ***', () => {
            const result = scanner.scan('IP: 10.0.0.42');
            const ip = result.matches.find((m) => m.type === 'ip_address')!;
            expect(ip.masked).toBe('10.0.0.***');
        });

        it('should mask 192.168.1.100 to 192.168.1.***', () => {
            const result = scanner.scan('Host: 192.168.1.100');
            const ip = result.matches.find((m) => m.type === 'ip_address')!;
            expect(ip.masked).toBe('192.168.1.***');
        });

        it('should replace IP in maskedText', () => {
            const result = scanner.scan('Connect to 10.20.30.40 for access');
            expect(result.maskedText).not.toContain('10.20.30.40');
            expect(result.maskedText).toContain('10.20.30.***');
        });

        it('should detect multiple IPs', () => {
            const result = scanner.scan('From 1.2.3.4 to 5.6.7.8');
            const ips = result.matches.filter((m) => m.type === 'ip_address');
            expect(ips).toHaveLength(2);
        });
    });

    // ───────────────────────────────────────────────────────
    // 8. Multi-PII Detection
    // ───────────────────────────────────────────────────────

    describe('multi-PII in single text', () => {
        it('should detect email + phone in one message', () => {
            const result = scanner.scan('Reach me at user@example.com or 555-123-4567');
            expect(result.hasPII).toBe(true);
            expect(result.piiCount).toBeGreaterThanOrEqual(2);
            const types = result.matches.map((m) => m.type);
            expect(types).toContain('email');
            expect(types).toContain('phone');
        });

        it('should detect email + SSN + CC in one message', () => {
            const result = scanner.scan(
                'Info: user@test.com, SSN 123-45-6789, Card 4111-1111-1111-1111'
            );
            expect(result.hasPII).toBe(true);
            const types = result.matches.map((m) => m.type);
            expect(types).toContain('email');
            expect(types).toContain('ssn');
            expect(types).toContain('credit_card');
        });

        it('should mask ALL PII entries in maskedText', () => {
            const result = scanner.scan('Email: alice@example.com, IP: 1.2.3.4');
            expect(result.maskedText).not.toContain('alice@example.com');
            expect(result.maskedText).not.toContain('1.2.3.4');
            expect(result.maskedText).toContain('al***@example.com');
            expect(result.maskedText).toContain('1.2.3.***');
        });

        it('piiCount should equal matches.length', () => {
            const result = scanner.scan(
                'a@b.com 555-123-4567 123-45-6789'
            );
            expect(result.piiCount).toBe(result.matches.length);
        });
    });

    // ───────────────────────────────────────────────────────
    // 9. Custom Pattern via addPattern()
    // ───────────────────────────────────────────────────────

    describe('addPattern — custom patterns', () => {
        it('should increase pattern count after adding', () => {
            expect(scanner.count()).toBe(5);
            scanner.addPattern('passport', /[A-Z]\d{7}/g, () => '***PASSPORT***');
            expect(scanner.count()).toBe(6);
        });

        it('should list custom type in listTypes()', () => {
            scanner.addPattern('passport', /[A-Z]\d{7}/g, () => '***PASSPORT***');
            expect(scanner.listTypes()).toContain('passport');
        });

        it('should detect custom pattern in scan', () => {
            scanner.addPattern('passport', /[A-Z]\d{7}/g, () => '***PASSPORT***');
            const result = scanner.scan('Passport: A1234567');
            expect(result.hasPII).toBe(true);
            expect(result.matches[0].type).toBe('passport');
            expect(result.matches[0].value).toBe('A1234567');
            expect(result.matches[0].masked).toBe('***PASSPORT***');
        });

        it('should apply custom mask function in maskedText', () => {
            scanner.addPattern('passport', /[A-Z]\d{7}/g, () => '[REDACTED]');
            const result = scanner.scan('Doc: A1234567 filed');
            expect(result.maskedText).toContain('[REDACTED]');
            expect(result.maskedText).not.toContain('A1234567');
        });

        it('should work alongside built-in patterns', () => {
            scanner.addPattern('custom_id', /ID-\d{6}/g, () => 'ID-******');
            const result = scanner.scan('user@test.com has ID-123456');
            expect(result.piiCount).toBe(2);
            const types = result.matches.map((m) => m.type);
            expect(types).toContain('email');
            expect(types).toContain('custom_id');
        });

        it('should support multiple custom patterns', () => {
            scanner.addPattern('vin', /[A-HJ-NPR-Z0-9]{17}/g, () => '*VIN*');
            scanner.addPattern('license', /[A-Z]{2}\d{4}[A-Z]{2}/g, () => '*PLATE*');
            expect(scanner.count()).toBe(7);
            expect(scanner.listTypes()).toContain('vin');
            expect(scanner.listTypes()).toContain('license');
        });
    });

    // ───────────────────────────────────────────────────────
    // 10. Stats Tracking
    // ───────────────────────────────────────────────────────

    describe('stats tracking', () => {
        it('should increment scanned counter on each scan', () => {
            scanner.scan('Hello');
            scanner.scan('World');
            scanner.scan('Test');
            expect(scanner.getStats().scanned).toBe(3);
        });

        it('should track total PII found across scans', () => {
            scanner.scan('Email: a@b.com');
            scanner.scan('SSN: 123-45-6789');
            scanner.scan('No PII here');
            expect(scanner.getStats().piiFound).toBe(2);
        });

        it('should accumulate PII count for multi-PII scans', () => {
            scanner.scan('a@b.com and c@d.com');
            scanner.scan('IP: 1.2.3.4');
            expect(scanner.getStats().piiFound).toBe(3);
        });

        it('getStats should return a copy (not a reference)', () => {
            scanner.scan('test@x.com');
            const stats1 = scanner.getStats();
            scanner.scan('test2@x.com');
            const stats2 = scanner.getStats();
            expect(stats1.scanned).toBe(1);
            expect(stats2.scanned).toBe(2);
        });

        it('should count 0 PII for clean text scans', () => {
            scanner.scan('Clean text 1');
            scanner.scan('Clean text 2');
            expect(scanner.getStats().piiFound).toBe(0);
            expect(scanner.getStats().scanned).toBe(2);
        });
    });

    // ───────────────────────────────────────────────────────
    // 11. Boundary & Edge Cases
    // ───────────────────────────────────────────────────────

    describe('boundary & edge cases', () => {
        it('should handle very long text without error', { timeout: 30000 }, () => {
            const longText = 'a'.repeat(10_000) + ' user@example.com ' + 'b'.repeat(10_000);
            const result = scanner.scan(longText);
            expect(result.hasPII).toBe(true);
            expect(result.piiCount).toBe(1);
            expect(result.matches[0].type).toBe('email');
        });

        it('should handle text with only whitespace', () => {
            const result = scanner.scan('   \n\t  ');
            expect(result.hasPII).toBe(false);
        });

        it('should handle text with special characters', () => {
            const result = scanner.scan('!@#$%^&*()_+{}|:"<>?');
            expect(result.hasPII).toBe(false);
        });

        it('should handle text with newlines between PII', () => {
            const result = scanner.scan('Email:\nuser@example.com\nSSN:\n123-45-6789');
            expect(result.piiCount).toBe(2);
        });

        it('should preserve non-PII text structure in maskedText', () => {
            const result = scanner.scan('Hello World, no PII here!');
            expect(result.maskedText).toBe('Hello World, no PII here!');
        });

        it('should handle email at the very start of text', () => {
            const result = scanner.scan('admin@test.com is the admin');
            expect(result.hasPII).toBe(true);
            expect(result.matches[0].startIndex).toBe(0);
        });

        it('should handle email at the very end of text', () => {
            const result = scanner.scan('Contact admin@test.com');
            expect(result.hasPII).toBe(true);
            const match = result.matches[0];
            expect(match.endIndex).toBe('Contact admin@test.com'.length);
        });

        it('should handle back-to-back PII entries gracefully', () => {
            const result = scanner.scan('123-45-6789987-65-4321');
            expect(result).toBeDefined();
            expect(typeof result.hasPII).toBe('boolean');
        });

        it('should handle Unicode text without false positives', () => {
            const result = scanner.scan('こんにちは世界 안녕하세요 مرحبا');
            expect(result.hasPII).toBe(false);
        });
    });

    // ───────────────────────────────────────────────────────
    // 12. PIIMatch shape validation
    // ───────────────────────────────────────────────────────

    describe('PIIMatch shape', () => {
        it('should have correct properties on each match', () => {
            const result = scanner.scan('Email: alice@example.com');
            const match = result.matches[0];
            expect(match).toHaveProperty('type');
            expect(match).toHaveProperty('value');
            expect(match).toHaveProperty('masked');
            expect(match).toHaveProperty('startIndex');
            expect(match).toHaveProperty('endIndex');
            expect(typeof match.type).toBe('string');
            expect(typeof match.value).toBe('string');
            expect(typeof match.masked).toBe('string');
            expect(typeof match.startIndex).toBe('number');
            expect(typeof match.endIndex).toBe('number');
        });

        it('endIndex should always be greater than startIndex', () => {
            const result = scanner.scan('SSN 123-45-6789 and email a@b.com');
            for (const match of result.matches) {
                expect(match.endIndex).toBeGreaterThan(match.startIndex);
            }
        });

        it('endIndex - startIndex should equal value.length', () => {
            const result = scanner.scan('Card 4111-1111-1111-9999 here');
            for (const match of result.matches) {
                expect(match.endIndex - match.startIndex).toBe(match.value.length);
            }
        });
    });

    // ───────────────────────────────────────────────────────
    // 13. Instance Isolation
    // ───────────────────────────────────────────────────────

    describe('instance isolation', () => {
        it('separate instances should have independent stats', () => {
            const scanner2 = new PIIScanner();
            scanner.scan('a@b.com');
            expect(scanner.getStats().scanned).toBe(1);
            expect(scanner2.getStats().scanned).toBe(0);
        });

        it('custom patterns on one instance should not leak to another', () => {
            const scanner2 = new PIIScanner();
            scanner.addPattern('custom', /CUSTOM/g, () => '***');
            expect(scanner.count()).toBe(6);
            expect(scanner2.count()).toBe(5);
            expect(scanner2.listTypes()).not.toContain('custom');
        });
    });

    // ───────────────────────────────────────────────────────
    // 14. Regex Statefulness Safety
    // ───────────────────────────────────────────────────────

    describe('regex statefulness — repeated scans', () => {
        it('should produce consistent results across repeated scans of the same text', () => {
            const text = 'Email user@test.com and SSN 111-22-3333';
            const r1 = scanner.scan(text);
            const r2 = scanner.scan(text);
            const r3 = scanner.scan(text);
            expect(r1.piiCount).toBe(r2.piiCount);
            expect(r2.piiCount).toBe(r3.piiCount);
            expect(r1.matches.map((m) => m.value)).toEqual(r2.matches.map((m) => m.value));
        });

        it('should not carry state between different scans', () => {
            const r1 = scanner.scan('a@b.com');
            const r2 = scanner.scan('No PII here');
            expect(r1.hasPII).toBe(true);
            expect(r2.hasPII).toBe(false);
        });
    });
});
