const OPENAI_API_BASE_URL_PATTERN = /^https?:\/\/api\.openai\.com(?:\/v1)?\/?$/i;
const OPENAI_CODEX_BASE_URL_PATTERN =
  /^https?:\/\/chatgpt\.com\/backend-api(?:\/codex)?(?:\/v1)?\/?$/i;

export const OPENAI_CODEX_RESPONSES_BASE_URL = "https://chatgpt.com/backend-api/codex";

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function isOpenAIApiBaseUrl(baseUrl?: string): boolean {
  const trimmed = normalizeOptionalString(baseUrl);
  return trimmed ? OPENAI_API_BASE_URL_PATTERN.test(trimmed) : false;
}

export function isOpenAICodexBaseUrl(baseUrl?: string): boolean {
  const trimmed = normalizeOptionalString(baseUrl);
  return trimmed ? OPENAI_CODEX_BASE_URL_PATTERN.test(trimmed) : false;
}

export function canonicalizeCodexResponsesBaseUrl(baseUrl?: string): string | undefined {
  if (!baseUrl) {
    return undefined;
  }
  return isOpenAICodexBaseUrl(baseUrl) ? OPENAI_CODEX_RESPONSES_BASE_URL : baseUrl;
}
