export const SYSTEM_PROMPT_CACHE_BOUNDARY = "\n<!-- COREBLOW_CACHE_BOUNDARY -->\n";

export function stripSystemPromptCacheBoundary(text: string): string {
  return text.replaceAll(SYSTEM_PROMPT_CACHE_BOUNDARY, "\n");
}

export function splitSystemPromptCacheBoundary(text: string):
  | {
      stablePrefix: string;
      dynamicSuffix: string;
    }
  | undefined {
  const boundaryIndex = text.indexOf(SYSTEM_PROMPT_CACHE_BOUNDARY);
  if (boundaryIndex === -1) {
    return undefined;
  }
  return {
    stablePrefix: text.slice(0, boundaryIndex).trimEnd(),
    dynamicSuffix: text.slice(boundaryIndex + SYSTEM_PROMPT_CACHE_BOUNDARY.length).trimStart(),
  };
}

export function prependSystemPromptAdditionAfterCacheBoundary(params: {
  systemPrompt: string;
  systemPromptAddition: string;
}): string {
  const systemPromptAddition = params.systemPromptAddition.trim();
  if (!systemPromptAddition) {
    return params.systemPrompt;
  }
  const split = splitSystemPromptCacheBoundary(params.systemPrompt);
  if (!split) {
    return `${params.systemPrompt}${SYSTEM_PROMPT_CACHE_BOUNDARY}${systemPromptAddition}`;
  }
  const dynamicSuffix = split.dynamicSuffix.trim();
  if (!dynamicSuffix) {
    return `${split.stablePrefix}${SYSTEM_PROMPT_CACHE_BOUNDARY}${systemPromptAddition}`;
  }
  return `${split.stablePrefix}${SYSTEM_PROMPT_CACHE_BOUNDARY}${systemPromptAddition}\n\n${dynamicSuffix}`;
}
