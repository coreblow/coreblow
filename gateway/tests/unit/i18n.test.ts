/**
 * tests/unit/i18n.test.ts
 * Tests for the i18n system
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const LOCALES_DIR = path.join(process.cwd(), 'locales');
const SUPPORTED = ['en', 'id', 'ja', 'ko', 'zh', 'es', 'fr', 'de', 'pt', 'ar'];

describe('i18n Locale Files', () => {
    it('should have all 10 locale files', () => {
        for (const locale of SUPPORTED) {
            const filePath = path.join(LOCALES_DIR, `${locale}.json`);
            expect(fs.existsSync(filePath), `Missing locale: ${locale}.json`).toBe(true);
        }
    });

    it('should parse all locale files as valid JSON', () => {
        for (const locale of SUPPORTED) {
            const content = fs.readFileSync(path.join(LOCALES_DIR, `${locale}.json`), 'utf-8');
            expect(() => JSON.parse(content)).not.toThrow();
        }
    });

    it('should have the same top-level keys in all locales', () => {
        const enContent = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf-8'));
        const enKeys = Object.keys(enContent).sort();

        for (const locale of SUPPORTED) {
            const content = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${locale}.json`), 'utf-8'));
            const keys = Object.keys(content).sort();
            expect(keys, `Locale ${locale} has different top-level keys`).toEqual(enKeys);
        }
    });

    it('should have consistent nested keys across all locales', () => {
        const enContent = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf-8'));

        for (const locale of SUPPORTED) {
            if (locale === 'en') continue;
            const content = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${locale}.json`), 'utf-8'));

            for (const section of Object.keys(enContent)) {
                const enKeys = Object.keys(enContent[section]).sort();
                const localeKeys = Object.keys(content[section] || {}).sort();
                expect(localeKeys, `${locale}.${section} has different keys`).toEqual(enKeys);
            }
        }
    });

    it('should have no empty translation values', () => {
        for (const locale of SUPPORTED) {
            const content = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${locale}.json`), 'utf-8'));
            for (const section of Object.keys(content)) {
                for (const [key, value] of Object.entries(content[section])) {
                    expect(typeof value, `${locale}.${section}.${key} is not a string`).toBe('string');
                    expect((value as string).length, `${locale}.${section}.${key} is empty`).toBeGreaterThan(0);
                }
            }
        }
    });

    it('should preserve {{variable}} placeholders across locales', () => {
        const enContent = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf-8'));

        for (const locale of SUPPORTED) {
            if (locale === 'en') continue;
            const content = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${locale}.json`), 'utf-8'));

            for (const section of Object.keys(enContent)) {
                for (const key of Object.keys(enContent[section])) {
                    const enVars = (enContent[section][key] as string).match(/\{\{(\w+)\}\}/g) || [];
                    const localeVars = (content[section]?.[key] as string || '').match(/\{\{(\w+)\}\}/g) || [];
                    expect(localeVars.sort(), `${locale}.${section}.${key} has different {{variables}}`).toEqual(enVars.sort());
                }
            }
        }
    });

    it('should have "app.name" as "CoreBlow AI Gateway" in all locales', () => {
        for (const locale of SUPPORTED) {
            const content = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${locale}.json`), 'utf-8'));
            expect(content.app.name).toBe('CoreBlow AI Gateway');
        }
    });
});
