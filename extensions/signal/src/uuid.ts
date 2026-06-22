const HYPHENATED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMPACT = /^[0-9a-f]{32}$/i;

export function looksLikeUuid(value: string): boolean {
  if (HYPHENATED.test(value) || COMPACT.test(value)) return true;
  const compact = value.replaceAll("-", "");
  return /^[0-9a-f]+$/i.test(compact) && /[a-f]/i.test(compact);
}
