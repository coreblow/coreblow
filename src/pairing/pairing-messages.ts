/**
 * pairing/pairing-messages.ts
 * Pairing-specific message formatting.
 */

import { formatCliCommand } from "../cli/command-format.js";
import type { PairingChannel } from "./pairing-store.js";

export function buildPairingReply(params: {
    channel: PairingChannel;
    idLine: string;
    code: string;
}): string {
    const { channel, idLine, code } = params;
    const approveCommand = formatCliCommand(`coreblow pairing approve ${channel} ${code}`);
    return [
        "CoreBlow: access not configured.",
        "",
        idLine,
        "pairing code:",
        "```",
        code,
        "```",
        "",
        "Ask the bot owner to approve with:",
        formatCliCommand(`coreblow pairing approve ${channel} ${code}`),
        "```",
        approveCommand,
        "```",
    ].join("\n");
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
