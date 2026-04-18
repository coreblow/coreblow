/**
 * pairing/pairing-messages.ts
 * Pairing-specific message formatting.
 * Ported from CoreBlow src/pairing/pairing-messages.ts.
 */

export function buildPairingReply(params: {
    channel: string;
    idLine: string;
    code: string;
}): string {
    const lines = [
        '🔑 **Device Pairing Required**',
        '',
        `Your ${params.channel} account (${params.idLine}) is not yet paired with this CoreBlow instance.`,
        '',
        'To pair, run the following command on the machine hosting CoreBlow:',
        '',
        `\`\`\``,
        `coreblow pair accept ${params.code}`,
        `\`\`\``,
        '',
        `Or open the dashboard and enter pairing code: **${params.code}**`,
        '',
        '_This code expires in 1 hour._',
    ];
    return lines.join('\n');
}

export function buildPairingSuccessReply(params: {
    channel: string;
    senderId: string;
}): string {
    return `✅ **Paired!** Your ${params.channel} account (${params.senderId}) is now paired with this CoreBlow instance.`;
}

export function buildPairingRejectedReply(): string {
    return '❌ **Pairing Rejected.** The pairing request was declined by the operator.';
}

export function buildPairingExpiredReply(): string {
    return '⏰ **Pairing Code Expired.** Please send a new message to receive a fresh pairing code.';
}

export function buildPairingAlreadyExistsReply(): string {
    return '✅ Your device is already paired. You can send messages normally.';
}
