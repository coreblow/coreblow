import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type TranslationTree = {
  readonly [key: string]: string | TranslationTree | undefined;
};

type LocaleRegistry = {
  DEFAULT_LOCALE: string;
  SUPPORTED_LOCALES: readonly string[];
  loadLazyLocaleTranslation(locale: string): Promise<TranslationTree | null>;
  resolveNavigatorLocale(locale: string): string;
};

const registryModuleUrl = new URL("../../ui/src/i18n/lib/registry.ts", import.meta.url);
const describeWhenUiI18nPresent = fs.existsSync(fileURLToPath(registryModuleUrl))
  ? describe
  : describe.skip;

const registry =
  describeWhenUiI18nPresent === describe
    ? ((await import("../../ui/src/i18n/lib/registry.ts")) as LocaleRegistry)
    : undefined;

function getRegistry(): LocaleRegistry {
  if (registry === undefined) {
    throw new Error("expected UI i18n registry to be present");
  }
  return registry;
}

function getNestedTranslation(map: TranslationTree | null, ...path: string[]): string | undefined {
  let value: string | TranslationTree | undefined = map ?? undefined;
  for (const key of path) {
    if (value === undefined || typeof value === "string") {
      return undefined;
    }
    value = value[key];
  }
  return typeof value === "string" ? value : undefined;
}

describeWhenUiI18nPresent("ui i18n locale registry", () => {
  it("lists supported CoreBlow locales", () => {
    const localeRegistry = getRegistry();

    expect(localeRegistry.SUPPORTED_LOCALES).toEqual([
      "en",
      "ar",
      "de",
      "es",
      "fr",
      "id",
      "ja",
      "ko",
      "pt",
      "zh",
    ]);
    expect(localeRegistry.DEFAULT_LOCALE).toBe("en");
  });

  it("resolves browser locale fallbacks", () => {
    const localeRegistry = getRegistry();

    expect(localeRegistry.resolveNavigatorLocale("de-DE")).toBe("de");
    expect(localeRegistry.resolveNavigatorLocale("es-MX")).toBe("es");
    expect(localeRegistry.resolveNavigatorLocale("pt-BR")).toBe("pt");
    expect(localeRegistry.resolveNavigatorLocale("zh-CN")).toBe("zh");
    expect(localeRegistry.resolveNavigatorLocale("en-US")).toBe("en");
    expect(localeRegistry.resolveNavigatorLocale("ja-JP")).toBe("ja");
    expect(localeRegistry.resolveNavigatorLocale("ko-KR")).toBe("ko");
    expect(localeRegistry.resolveNavigatorLocale("id-ID")).toBe("id");
    expect(localeRegistry.resolveNavigatorLocale("unknown")).toBe("en");
  });

  it("loads lazy locale translations from the registry", async () => {
    const localeRegistry = getRegistry();
    const [de, es, pt, zh, en] = await Promise.all([
      localeRegistry.loadLazyLocaleTranslation("de"),
      localeRegistry.loadLazyLocaleTranslation("es"),
      localeRegistry.loadLazyLocaleTranslation("pt"),
      localeRegistry.loadLazyLocaleTranslation("zh"),
      localeRegistry.loadLazyLocaleTranslation("en"),
    ]);

    expect(getNestedTranslation(de, "common", "health")).toBe("Zustand");
    expect(getNestedTranslation(es, "common", "health")).toBe("Salud");
    expect(getNestedTranslation(pt, "common", "ok")).toBe("OK");
    expect(getNestedTranslation(zh, "languages", "en")).toBe("English");
    expect(en).toBeNull();
  });
});
