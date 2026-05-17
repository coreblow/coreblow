/**
 * CoreBlow UI locale registry.
 *
 * Uses the reference lazy-loading pattern: English is bundled inline,
 * all other locales are loaded on-demand via dynamic import().
 */

import type { Locale, TranslationMap } from "./types.ts";

type LazyLocale = Exclude<Locale, "en">;

interface LazyLocaleRegistration {
  exportName: string;
  loader: () => Promise<Record<string, TranslationMap>>;
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
  ar: { exportName: "ar", loader: () => import("../locales/ar.ts") },
  de: { exportName: "de", loader: () => import("../locales/de.ts") },
  es: { exportName: "es", loader: () => import("../locales/es.ts") },
  fr: { exportName: "fr", loader: () => import("../locales/fr.ts") },
  id: { exportName: "id", loader: () => import("../locales/id.ts") },
  ja: { exportName: "ja", loader: () => import("../locales/ja.ts") },
  ko: { exportName: "ko", loader: () => import("../locales/ko.ts") },
  pt: { exportName: "pt", loader: () => import("../locales/pt.ts") },
  zh: { exportName: "zh", loader: () => import("../locales/zh.ts") },
};

export const SUPPORTED_LOCALES: ReadonlyArray<Locale> = [DEFAULT_LOCALE, ...LAZY_LOCALES];

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return value !== null && value !== undefined && SUPPORTED_LOCALES.includes(value as Locale);
}

function isLazyLocale(locale: Locale): locale is LazyLocale {
  return LAZY_LOCALES.includes(locale as LazyLocale);
}

/**
 * Resolve a browser navigator locale to a supported CoreBlow locale.
 */
export function resolveNavigatorLocale(navLang: string): Locale {
  const lower = navLang.toLowerCase();

  if (isSupportedLocale(lower)) {
    return lower;
  }

  const primary = lower.split("-")[0];
  if (primary !== undefined && isSupportedLocale(primary)) {
    return primary;
  }

  return DEFAULT_LOCALE;
}

export async function loadLazyLocaleTranslation(locale: Locale): Promise<TranslationMap | null> {
  if (!isLazyLocale(locale)) {
    return null;
  }
  const registration = LAZY_LOCALE_REGISTRY[locale];
  const module = await registration.loader();
  return module[registration.exportName] ?? null;
}
