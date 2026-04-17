/**
 * CoreBlow AutoPilot — normalizeInboundText
 *
 * Normalize inbound text for processing.
 */
export function normalizeInboundText(text: string): string {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\u200B/g, '') // zero-width space
        .trim();
}
