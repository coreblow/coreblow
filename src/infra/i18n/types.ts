/**
 * CoreBlow i18n type definitions.
 *
 * Uses the reference TranslationMap pattern: nested string records
 * where leaves are translatable strings and branches are namespaces.
 */

/** Recursive translation map — values are either strings or nested maps. */
export type TranslationMap = { [key: string]: string | TranslationMap };

/**
 * Supported locale codes.
 *
 * CoreBlow ships 10 locales. All non-English locales
 * are loaded lazily at runtime to avoid bundling unused translations.
 */
export type Locale = "en" | "ar" | "de" | "es" | "fr" | "id" | "ja" | "ko" | "pt" | "zh";

export interface I18nConfig {
  locale: Locale;
  fallbackLocale: Locale;
  translations: Partial<Record<Locale, TranslationMap>>;
}
