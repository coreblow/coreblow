import {
  getScopedCredentialValue,
  resolveProviderWebSearchPluginConfig,
  setProviderWebSearchPluginConfigValue,
  setScopedCredentialValue,
  type WebSearchProviderPlugin,
} from "coreblow/plugin-sdk/provider-web-search";

export const BRAVE_CREDENTIAL_PATH = "plugins.entries.brave.config.webSearch.apiKey";

type BraveConfig = {
  mode?: string;
};

type BraveLlmContextResult = { url: string; title: string; snippets: string[] };

export type BraveLlmContextResponse = {
  grounding: { generic?: BraveLlmContextResult[] };
  sources?: { url?: string; hostname?: string; date?: string }[];
};

const BRAVE_ONBOARDING_SCOPES: Array<"text-inference"> = ["text-inference"];

const BRAVE_COUNTRY_CODES = new Set([
  "AR",
  "AU",
  "AT",
  "BE",
  "BR",
  "CA",
  "CL",
  "DK",
  "FI",
  "FR",
  "DE",
  "GR",
  "HK",
  "IN",
  "ID",
  "IT",
  "JP",
  "KR",
  "MY",
  "MX",
  "NL",
  "NZ",
  "NO",
  "CN",
  "PL",
  "PT",
  "PH",
  "RU",
  "SA",
  "ZA",
  "ES",
  "SE",
  "CH",
  "TW",
  "TR",
  "GB",
  "US",
  "ALL",
]);

const BRAVE_SEARCH_LANG_CODES = new Set([
  "ar",
  "eu",
  "bn",
  "bg",
  "ca",
  "zh-hans",
  "zh-hant",
  "hr",
  "cs",
  "da",
  "nl",
  "en",
  "en-gb",
  "et",
  "fi",
  "fr",
  "gl",
  "de",
  "el",
  "gu",
  "he",
  "hi",
  "hu",
  "is",
  "it",
  "jp",
  "kn",
  "ko",
  "lv",
  "lt",
  "ms",
  "ml",
  "mr",
  "nb",
  "pl",
  "pt-br",
  "pt-pt",
  "pa",
  "ro",
  "ru",
  "sr",
  "sk",
  "sl",
  "es",
  "sv",
  "ta",
  "te",
  "th",
  "tr",
  "uk",
  "vi",
]);

const BRAVE_SEARCH_LANG_ALIASES: Record<string, string> = {
  ja: "jp",
  zh: "zh-hans",
  "zh-cn": "zh-hans",
  "zh-hk": "zh-hant",
  "zh-sg": "zh-hans",
  "zh-tw": "zh-hant",
};

const BRAVE_UI_LANG_LOCALE = /^([a-z]{2})-([a-z]{2})$/i;

function normalizeOptionalString(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

function normalizeBraveSearchLang(value: string | undefined): string | undefined {
  const trimmed = normalizeOptionalString(value);
  if (!trimmed) {
    return undefined;
  }
  const canonical = BRAVE_SEARCH_LANG_ALIASES[trimmed.toLowerCase()] ?? trimmed.toLowerCase();
  if (!BRAVE_SEARCH_LANG_CODES.has(canonical)) {
    return undefined;
  }
  return canonical;
}

export function normalizeBraveCountry(value: string | undefined): string | undefined {
  const trimmed = normalizeOptionalString(value);
  if (!trimmed) {
    return undefined;
  }
  const canonical = trimmed.toUpperCase();
  return BRAVE_COUNTRY_CODES.has(canonical) ? canonical : "ALL";
}

function normalizeBraveUiLang(value: string | undefined): string | undefined {
  const trimmed = normalizeOptionalString(value);
  if (!trimmed) {
    return undefined;
  }
  const match = trimmed.match(BRAVE_UI_LANG_LOCALE);
  if (!match) {
    return undefined;
  }
  const [, language, region] = match;
  return `${language.toLowerCase()}-${region.toUpperCase()}`;
}

export function resolveBraveConfig(searchConfig?: Record<string, unknown>): BraveConfig {
  const brave = searchConfig?.brave;
  return brave && typeof brave === "object" && !Array.isArray(brave) ? (brave as BraveConfig) : {};
}

export function resolveBraveMode(brave?: BraveConfig): "web" | "llm-context" {
  return brave?.mode === "llm-context" ? "llm-context" : "web";
}

export function normalizeBraveLanguageParams(params: { search_lang?: string; ui_lang?: string }): {
  search_lang?: string;
  ui_lang?: string;
  invalidField?: "search_lang" | "ui_lang";
} {
  const rawSearchLang = normalizeOptionalString(params.search_lang);
  const rawUiLang = normalizeOptionalString(params.ui_lang);
  let searchLangCandidate = rawSearchLang;
  let uiLangCandidate = rawUiLang;

  if (normalizeBraveUiLang(rawSearchLang) && normalizeBraveSearchLang(rawUiLang)) {
    searchLangCandidate = rawUiLang;
    uiLangCandidate = rawSearchLang;
  }

  const search_lang = normalizeBraveSearchLang(searchLangCandidate);
  if (searchLangCandidate && !search_lang) {
    return { invalidField: "search_lang" };
  }

  const ui_lang = normalizeBraveUiLang(uiLangCandidate);
  if (uiLangCandidate && !ui_lang) {
    return { invalidField: "ui_lang" };
  }

  return { search_lang, ui_lang };
}

function resolveSiteName(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

export function mapBraveLlmContextResults(
  data: BraveLlmContextResponse,
): { url: string; title: string; snippets: string[]; siteName?: string }[] {
  const genericResults = Array.isArray(data.grounding?.generic) ? data.grounding.generic : [];
  return genericResults.map((entry) => ({
    url: entry.url ?? "",
    title: entry.title ?? "",
    snippets: (entry.snippets ?? []).filter((snippet) => typeof snippet === "string" && snippet),
    siteName: resolveSiteName(entry.url) || undefined,
  }));
}

export function createBraveWebSearchProviderBase(): Omit<
  WebSearchProviderPlugin,
  "createTool"
> {
  return {
    id: "brave",
    label: "Brave Search",
    hint: "Structured results · country/language/time filters",
    onboardingScopes: [...BRAVE_ONBOARDING_SCOPES],
    credentialLabel: "Brave Search API key",
    envVars: ["BRAVE_API_KEY"],
    placeholder: "BSA...",
    signupUrl: "https://brave.com/search/api/",
    docsUrl: "https://docs.coreblow.ai/brave-search",
    autoDetectOrder: 10,
    credentialPath: BRAVE_CREDENTIAL_PATH,
    inactiveSecretPaths: [BRAVE_CREDENTIAL_PATH],
    getCredentialValue: (searchConfig) => getScopedCredentialValue(searchConfig, "brave"),
    setCredentialValue: (searchConfigTarget, value) =>
      setScopedCredentialValue(searchConfigTarget, "brave", value),
    getConfiguredCredentialValue: (config) =>
      resolveProviderWebSearchPluginConfig(config, "brave")?.apiKey,
    setConfiguredCredentialValue: (configTarget, value) => {
      setProviderWebSearchPluginConfigValue(configTarget, "brave", "apiKey", value);
    },
  };
}
