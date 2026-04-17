/**
 * i18n/engine.ts
 * Internationalization engine — string key resolution with locale fallback.
 */

export type Locale = string;
export type TranslationMap = Record<string, string>;

const translations = new Map<Locale, TranslationMap>();
let currentLocale: Locale = 'en';
const fallbackLocale: Locale = 'en';

export function setLocale(locale: Locale): void {
    currentLocale = locale;
}

export function getLocale(): Locale {
    return currentLocale;
}

export function registerTranslations(locale: Locale, strings: TranslationMap): void {
    const existing = translations.get(locale) ?? {};
    translations.set(locale, { ...existing, ...strings });
}

export function t(key: string, params?: Record<string, string | number>): string {
    const map = translations.get(currentLocale) ?? translations.get(fallbackLocale);
    let value = map?.[key] ?? key;
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            value = value.replace(`{${k}}`, String(v));
        }
    }
    return value;
}

export function hasTranslation(key: string, locale?: Locale): boolean {
    const map = translations.get(locale ?? currentLocale);
    return map !== undefined && key in map;
}

export function listLocales(): Locale[] {
    return [...translations.keys()];
}

export function clearTranslations(): void {
    translations.clear();
}
