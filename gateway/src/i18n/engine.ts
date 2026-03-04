/**
 * src/i18n/engine.ts
 * Internationalization engine — load locales, translate strings, detect OS language
 */

import fs from 'node:fs';
import path from 'node:path';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('i18n');

export type Locale = 'en' | 'id' | 'ja' | 'ko' | 'zh' | 'es' | 'fr' | 'de' | 'pt' | 'ar';

const SUPPORTED_LOCALES: Locale[] = ['en', 'id', 'ja', 'ko', 'zh', 'es', 'fr', 'de', 'pt', 'ar'];

interface I18nStrings {
    [key: string]: string | I18nStrings;
}

class I18nEngine {
    private currentLocale: Locale = 'en';
    private strings: Map<Locale, I18nStrings> = new Map();
    private fallback: Locale = 'en';

    /**
     * Initialize — load locale files and detect OS language
     */
    async init(forceLocale?: string): Promise<void> {
        // Load built-in locales
        const localesDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../../locales');

        for (const locale of SUPPORTED_LOCALES) {
            const filePath = path.join(localesDir, `${locale}.json`);
            if (fs.existsSync(filePath)) {
                try {
                    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    this.strings.set(locale, content);
                } catch (err: any) {
                    log.warn({ locale, err: err.message }, 'Failed to load locale');
                }
            }
        }

        // Detect locale
        if (forceLocale && SUPPORTED_LOCALES.includes(forceLocale as Locale)) {
            this.currentLocale = forceLocale as Locale;
        } else {
            this.currentLocale = this.detectLocale();
        }

        log.info({ locale: this.currentLocale, loaded: this.strings.size }, 'i18n initialized');
    }

    /**
     * Detect OS/env locale
     */
    private detectLocale(): Locale {
        const envLang = process.env.LANG || process.env.LC_ALL || process.env.LANGUAGE || '';
        const code = envLang.split(/[_.]/)[0]?.toLowerCase();

        if (code && SUPPORTED_LOCALES.includes(code as Locale)) {
            return code as Locale;
        }

        return 'en';
    }

    /**
     * Translate a key — supports dot notation (e.g., "gateway.started")
     * Supports variable substitution: {{variable}}
     */
    t(key: string, vars?: Record<string, string | number>): string {
        let value = this.resolve(key, this.currentLocale);

        // Fallback to English
        if (!value && this.currentLocale !== this.fallback) {
            value = this.resolve(key, this.fallback);
        }

        // Return key if not found
        if (!value) return key;

        // Variable substitution
        if (vars) {
            for (const [k, v] of Object.entries(vars)) {
                value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
            }
        }

        return value;
    }

    /**
     * Resolve a dot-notation key from a locale
     */
    private resolve(key: string, locale: Locale): string | null {
        const strings = this.strings.get(locale);
        if (!strings) return null;

        const parts = key.split('.');
        let current: any = strings;

        for (const part of parts) {
            if (current === undefined || current === null) return null;
            current = current[part];
        }

        return typeof current === 'string' ? current : null;
    }

    /**
     * Get current locale
     */
    getLocale(): Locale {
        return this.currentLocale;
    }

    /**
     * Set locale
     */
    setLocale(locale: Locale): void {
        if (SUPPORTED_LOCALES.includes(locale)) {
            this.currentLocale = locale;
            log.info({ locale }, 'Locale changed');
        }
    }

    /**
     * Get all supported locales with their display names
     */
    getSupportedLocales(): Array<{ code: Locale; name: string; nativeName: string }> {
        return [
            { code: 'en', name: 'English', nativeName: 'English' },
            { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
            { code: 'ja', name: 'Japanese', nativeName: '日本語' },
            { code: 'ko', name: 'Korean', nativeName: '한국어' },
            { code: 'zh', name: 'Chinese', nativeName: '中文' },
            { code: 'es', name: 'Spanish', nativeName: 'Español' },
            { code: 'fr', name: 'French', nativeName: 'Français' },
            { code: 'de', name: 'German', nativeName: 'Deutsch' },
            { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
            { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
        ];
    }
}

// Singleton
export const i18n = new I18nEngine();

// Shortcut
export const t = (key: string, vars?: Record<string, string | number>) => i18n.t(key, vars);
