/**
 * CoreBlow — I18n System
 *
 * Internationalization and localization for agent responses,
 * UI messages, and error strings. Supports locale switching,
 * pluralization, interpolation, and fallback chains.
 */

/** Locale messages */
export type LocaleMessages = Record<string, string | Record<string, string>>;

/** Pluralization rule */
export type PluralRule = (count: number) => string;

/**
 * CoreBlow I18n System
 */
export class I18n {
    private locales = new Map<string, LocaleMessages>();
    private currentLocale: string;
    private fallbackLocale: string;
    private pluralRules = new Map<string, PluralRule>();

    constructor(defaultLocale: string = 'en') {
        this.currentLocale = defaultLocale;
        this.fallbackLocale = 'en';

        // Built-in English messages
        this.addLocale('en', {
            'app.name': 'CoreBlow',
            'app.description': 'AI Gateway',
            'error.not_found': 'Not found: {{resource}}',
            'error.unauthorized': 'Unauthorized access',
            'error.rate_limit': 'Too many requests. Try again in {{seconds}} seconds.',
            'error.internal': 'Internal server error',
            'status.online': 'Online',
            'status.offline': 'Offline',
            'status.loading': 'Loading...',
            'agent.greeting': 'Hello! How can I help you?',
            'agent.thinking': 'Thinking...',
            'agent.error': 'Sorry, something went wrong.',
            'plural.message': { one: '{{count}} message', other: '{{count}} messages' },
            'plural.file': { one: '{{count}} file', other: '{{count}} files' },
        });

        // Indonesian
        this.addLocale('id', {
            'app.name': 'CoreBlow',
            'app.description': 'Gerbang AI',
            'error.not_found': 'Tidak ditemukan: {{resource}}',
            'error.unauthorized': 'Akses tidak diizinkan',
            'error.rate_limit': 'Terlalu banyak permintaan. Coba lagi dalam {{seconds}} detik.',
            'error.internal': 'Kesalahan server internal',
            'status.online': 'Online',
            'status.offline': 'Offline',
            'status.loading': 'Memuat...',
            'agent.greeting': 'Halo! Ada yang bisa saya bantu?',
            'agent.thinking': 'Sedang berpikir...',
            'agent.error': 'Maaf, terjadi kesalahan.',
            'plural.message': { one: '{{count}} pesan', other: '{{count}} pesan' },
            'plural.file': { one: '{{count}} file', other: '{{count}} file' },
        });

        // Default plural rules
        this.pluralRules.set('en', (n) => n === 1 ? 'one' : 'other');
        this.pluralRules.set('id', () => 'other');
    }

    /**
     * Add a locale.
     */
    addLocale(locale: string, messages: LocaleMessages): void {
        const existing = this.locales.get(locale) ?? {};
        this.locales.set(locale, { ...existing, ...messages });
    }

    /**
     * Set current locale.
     */
    setLocale(locale: string): boolean {
        if (!this.locales.has(locale)) return false;
        this.currentLocale = locale;
        return true;
    }

    /**
     * Get current locale.
     */
    getLocale(): string {
        return this.currentLocale;
    }

    /**
     * Translate a key.
     */
    t(key: string, params?: Record<string, string | number>): string {
        const message = this.resolve(key);
        if (typeof message !== 'string') return key;
        return this.interpolate(message, params);
    }

    /**
     * Translate with pluralization.
     */
    tp(key: string, count: number, params?: Record<string, string | number>): string {
        const messages = this.resolve(key);
        if (typeof messages === 'string') return this.interpolate(messages, { count, ...params });
        if (typeof messages !== 'object' || messages === null) return key;

        const rule = this.pluralRules.get(this.currentLocale) ?? this.pluralRules.get('en')!;
        const form = rule(count);
        const message = (messages as Record<string, string>)[form] ?? (messages as Record<string, string>)['other'] ?? key;
        return this.interpolate(message, { count, ...params });
    }

    /**
     * Check if a key exists.
     */
    has(key: string): boolean {
        return this.resolve(key) !== undefined;
    }

    /**
     * List available locales.
     */
    listLocales(): string[] {
        return Array.from(this.locales.keys());
    }

    // === Private ===

    private resolve(key: string): string | Record<string, string> | undefined {
        const current = this.locales.get(this.currentLocale);
        if (current && current[key] !== undefined) return current[key] as string | Record<string, string>;
        const fallback = this.locales.get(this.fallbackLocale);
        return fallback?.[key] as string | Record<string, string> | undefined;
    }

    private interpolate(message: string, params?: Record<string, string | number>): string {
        if (!params) return message;
        return message.replace(/\{\{(\w+)\}\}/g, (_, key) => {
            return params[key] !== undefined ? String(params[key]) : `{{${key}}}`;
        });
    }
}
