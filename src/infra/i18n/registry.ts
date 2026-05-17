/**
 * CoreBlow i18n locale registry.
 *
 * Uses the reference lazy-loading pattern: English is bundled inline,
 * all other locales are loaded on-demand via dynamic import() to keep
 * the initial bundle small.
 *
 * CoreBlow difference: locales are JSON files (not TypeScript), so the
 * dynamic import returns `{ default: TranslationMap }`.
 */

import type { Locale, TranslationMap } from "./types.js";

type LazyLocale = Exclude<Locale, "en">;

interface LazyLocaleRegistration {
  loader: () => Promise<{ default: TranslationMap }>;
}

export const DEFAULT_LOCALE: Locale = "en";

const LAZY_LOCALES: readonly LazyLocale[] = [
  "ar",
  "de",
  "es",
  "fr",
  "id",
  "ja",
  "ko",
  "pt",
  "zh",
];

const LAZY_LOCALE_REGISTRY: Record<LazyLocale, LazyLocaleRegistration> = {
  ar: { loader: () => import("./locales/ar.json", { with: { type: "json" } }) },
  de: { loader: () => import("./locales/de.json", { with: { type: "json" } }) },
  es: { loader: () => import("./locales/es.json", { with: { type: "json" } }) },
  fr: { loader: () => import("./locales/fr.json", { with: { type: "json" } }) },
  id: { loader: () => import("./locales/id.json", { with: { type: "json" } }) },
  ja: { loader: () => import("./locales/ja.json", { with: { type: "json" } }) },
  ko: { loader: () => import("./locales/ko.json", { with: { type: "json" } }) },
  pt: { loader: () => import("./locales/pt.json", { with: { type: "json" } }) },
  zh: { loader: () => import("./locales/zh.json", { with: { type: "json" } }) },
};

export const SUPPORTED_LOCALES: ReadonlyArray<Locale> = [DEFAULT_LOCALE, ...LAZY_LOCALES];

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return value !== null && value !== undefined && SUPPORTED_LOCALES.includes(value as Locale);
}

function isLazyLocale(locale: Locale): locale is LazyLocale {
  return LAZY_LOCALES.includes(locale as LazyLocale);
}

/**
 * Resolve a navigator/system locale string to a supported CoreBlow locale.
 *
 * Handles region subtags: "de-AT" → "de", "pt-BR" → "pt", "zh-TW" → "zh".
 */
export function resolveSystemLocale(systemLang: string): Locale {
  const lower = systemLang.toLowerCase();

  // Direct match first.
  if (isSupportedLocale(lower)) {
    return lower;
  }

  // Extract primary subtag (e.g. "de-AT" → "de").
  const primary = lower.split("-")[0];
  if (primary !== undefined && isSupportedLocale(primary)) {
    return primary;
  }

  return DEFAULT_LOCALE;
}

/**
 * Lazily load a non-English locale's translation map.
 *
 * Returns null for English (already bundled) or unsupported locales.
 */
export async function loadLazyLocaleTranslation(locale: Locale): Promise<TranslationMap | null> {
  if (!isLazyLocale(locale)) {
    return null;
  }
  const registration = LAZY_LOCALE_REGISTRY[locale];
  const module = await registration.loader();
  return module.default ?? null;
}
