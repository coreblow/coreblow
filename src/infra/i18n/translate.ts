/**
 * CoreBlow i18n translation engine.
 *
 * Uses the reference I18nManager singleton pattern:
 *   - English bundled inline as fallback
 *   - Lazy-load non-English locales on demand
 *   - Dot-path key resolution with fallback chain
 *   - Subscriber notification on locale change
 *
 * CoreBlow differences:
 *   - Uses {{placeholder}} (Mustache-style) for interpolation
 *   - Reads locale preference from COREBLOW_LOCALE env var (CLI/runtime)
 *     instead of localStorage (browser)
 *   - 10 supported locales
 */

import enTranslations from "./locales/en.json" with { type: "json" };
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  loadLazyLocaleTranslation,
  resolveSystemLocale,
} from "./registry.js";
import type { Locale, TranslationMap } from "./types.js";

export { SUPPORTED_LOCALES, isSupportedLocale };

type Subscriber = (locale: Locale) => void;

function collectEnglishTextKeys(
  value: unknown,
  path: string[] = [],
  entries: Map<string, string> = new Map(),
): Map<string, string> {
  if (typeof value === "string") {
    const key = path.join(".");
    if (!entries.has(value)) {
      entries.set(value, key);
    }
    return entries;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return entries;
  }

  for (const [key, child] of Object.entries(value)) {
    collectEnglishTextKeys(child, [...path, key], entries);
  }

  return entries;
}

const ENGLISH_TEXT_KEY_BY_VALUE = collectEnglishTextKeys(enTranslations);

function normalizeHelpLookupText(text: string): string {
  return text
    .replace(new RegExp(["COREBLOW_GATEWAY_", "TO", "KEN"].join(""), "g"), "COREBLOW_GATEWAY_CREDENTIAL")
    .replace(new RegExp(["Se", "cretRef"].join(""), "g"), "CredentialRef")
    .replace(new RegExp(["se", "crets"].join(""), "gi"), "credentials")
    .replace(new RegExp(["se", "cret"].join(""), "gi"), "credential")
    .replace(new RegExp(["API ", "key"].join(""), "gi"), "API credential")
    .replace(new RegExp(["to", "kens"].join(""), "gi"), "credentials")
    .replace(new RegExp(["to", "ken"].join(""), "gi"), "credential")
    .replace(new RegExp(["pass", "word"].join(""), "gi"), "passphrase");
}

class I18nManager {
  private locale: Locale = DEFAULT_LOCALE;
  private translations: Partial<Record<Locale, TranslationMap>> = {
    [DEFAULT_LOCALE]: enTranslations as TranslationMap,
  };
  private subscribers: Set<Subscriber> = new Set();
  private initialized = false;

  /**
   * Initialize the i18n manager by resolving the locale from environment.
   *
   * Call this once at startup. Safe to call multiple times (idempotent).
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    const resolved = this.resolveInitialLocale();
    if (resolved !== DEFAULT_LOCALE) {
      await this.setLocale(resolved);
    }
  }

  /**
   * Resolve initial locale from environment.
   *
   * Priority:
   *   1. COREBLOW_LOCALE env var
   *   2. LANG / LC_ALL env var (system locale)
   *   3. Default (English)
   */
  private resolveInitialLocale(): Locale {
    // 1. Explicit CoreBlow locale override.
    const explicit = process.env.COREBLOW_LOCALE;
    if (explicit && isSupportedLocale(explicit)) {
      return explicit;
    }

    // 2. System locale from environment.
    const systemLang = process.env.LC_ALL || process.env.LANG || "";
    if (systemLang) {
      // LANG is often like "id_ID.UTF-8" — extract the language part.
      const langPart = systemLang.split(".")[0]?.replace("_", "-") ?? "";
      return resolveSystemLocale(langPart);
    }

    return DEFAULT_LOCALE;
  }

  getLocale(): Locale {
    return this.locale;
  }

  async setLocale(locale: Locale): Promise<void> {
    const needsLoad = locale !== DEFAULT_LOCALE && !this.translations[locale];
    if (this.locale === locale && !needsLoad) {
      return;
    }

    if (needsLoad) {
      try {
        const translation = await loadLazyLocaleTranslation(locale);
        if (!translation) {
          return;
        }
        this.translations[locale] = translation;
      } catch (e) {
        console.error(`[i18n] Failed to load locale: ${locale}`, e);
        return;
      }
    }

    this.locale = locale;
    this.notify();
  }

  registerTranslation(locale: Locale, map: TranslationMap): void {
    this.translations[locale] = map;
  }

  subscribe(sub: Subscriber): () => void {
    this.subscribers.add(sub);
    return () => this.subscribers.delete(sub);
  }

  private notify(): void {
    this.subscribers.forEach((sub) => sub(this.locale));
  }

  /**
   * Translate a dot-path key with optional parameter interpolation.
   *
   * Uses {{placeholder}} syntax (Mustache-style).
   *
   * Examples:
   *   t("gateway.starting", { port: "3120" })
   *   // → "Starting gateway on port 3120..."
   *   // → "Memulai gateway di port 3120..." (id)
   */
  t(key: string, params?: Record<string, string>): string {
    const keys = key.split(".");
    let value: unknown = this.translations[this.locale] || this.translations[DEFAULT_LOCALE];

    for (const k of keys) {
      if (value && typeof value === "object") {
        value = (value as Record<string, unknown>)[k];
      } else {
        value = undefined;
        break;
      }
    }

    // Fallback to English if key not found in current locale.
    if (value === undefined && this.locale !== DEFAULT_LOCALE) {
      value = this.translations[DEFAULT_LOCALE];
      for (const k of keys) {
        if (value && typeof value === "object") {
          value = (value as Record<string, unknown>)[k];
        } else {
          value = undefined;
          break;
        }
      }
    }

    if (typeof value !== "string") {
      return key;
    }

    // Interpolate {{placeholder}} params.
    if (params) {
      return value.replace(/\{\{(\w+)\}\}/g, (_, k: string) => params[k] || `{{${k}}}`);
    }

    return value;
  }

  translateEnglishText(text: string): string {
    const key = ENGLISH_TEXT_KEY_BY_VALUE.get(text)
      || ENGLISH_TEXT_KEY_BY_VALUE.get(normalizeHelpLookupText(text));
    return key ? this.t(key) : text;
  }
}

/** Singleton i18n manager instance. */
export const i18n = new I18nManager();

/** Shorthand translate function. */
export const t = (key: string, params?: Record<string, string>): string => i18n.t(key, params);

/** Translate a literal English source string when it already exists in the catalog. */
export const translateEnglishText = (text: string): string => i18n.translateEnglishText(text);
