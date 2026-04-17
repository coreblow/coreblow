/**
 * CoreBlow AutoPilot — stripInboundMeta
 *
 * Strip metadata prefixes from inbound text.
 */
export function stripInboundMeta(text: string): { cleanText: string; meta: Record<string, string> } {
    const meta: Record<string, string> = {};
    let cleanText = text;

    // Strip @mentions
    cleanText = cleanText.replace(/@\w+/g, '').trim();

    // Strip [meta:value] patterns
    const metaPattern = /\[(\w+):([^\]]+)\]/g;
    let match;
    while ((match = metaPattern.exec(text)) !== null) {
        meta[match[1]!] = match[2]!;
        cleanText = cleanText.replace(match[0], '').trim();
    }

    return { cleanText, meta };
}
