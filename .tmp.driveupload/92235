/**
 * pairing/pairing-labels.ts
 * Human-readable labels and formatting for pairing state.
 * Ported from OpenClaw src/pairing/pairing-labels.ts.
 */

import type { PairingRequest } from './pairing-store.js';

export type PairingStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

/**
 * Format a pairing request for CLI/dashboard display.
 */
export function formatPairingRequest(request: PairingRequest): string {
    const age = formatAge(new Date(request.createdAt));
    const meta = request.meta ? Object.entries(request.meta).map(([k, v]) => `${k}=${v}`).join(', ') : '';
    const metaSuffix = meta ? ` (${meta})` : '';
    return `  ${request.code}  ${request.id}  [${age} ago]${metaSuffix}`;
}

/**
 * Format pending requests list for display.
 */
export function formatPendingList(requests: PairingRequest[]): string {
    if (requests.length === 0) return '  No pending pairing requests.';
    const header = '  Code      Sender ID                    Age';
    const separator = '  ' + '─'.repeat(50);
    const rows = requests.map(formatPairingRequest);
    return [header, separator, ...rows].join('\n');
}

/**
 * Format allowed list for display.
 */
export function formatAllowedList(senderIds: string[]): string {
    if (senderIds.length === 0) return '  No paired devices.';
    return senderIds.map((id, i) => `  ${i + 1}. ${id}`).join('\n');
}

/**
 * Get human-readable channel label for pairing UI.
 */
export function getChannelPairingLabel(channel: string): string {
    const labels: Record<string, string> = {
        discord: 'Discord',
        telegram: 'Telegram',
        slack: 'Slack',
        signal: 'Signal',
        whatsapp: 'WhatsApp',
        gmail: 'Gmail',
        imessage: 'iMessage',
    };
    return labels[channel] ?? channel;
}

/**
 * Format relative age.
 */
function formatAge(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h`;
}

/**
 * Build a pairing summary for the status command.
 */
export function buildPairingSummary(params: {
    pendingCount: number;
    pairedCount: number;
    channel?: string;
}): string {
    const lines: string[] = ['🔑 Pairing Status'];
    if (params.channel) lines.push(`  Channel: ${getChannelPairingLabel(params.channel)}`);
    lines.push(`  Pending: ${params.pendingCount}`);
    lines.push(`  Paired:  ${params.pairedCount}`);
    return lines.join('\n');
}
