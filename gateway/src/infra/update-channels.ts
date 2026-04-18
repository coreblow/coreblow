/** CoreBlow — Update Channels */
export type UpdateChannel = "stable" | "beta" | "alpha" | "nightly";
export function resolveUpdateChannel(env: NodeJS.ProcessEnv = process.env): UpdateChannel { const ch = env.COREBLOW_UPDATE_CHANNEL?.trim()?.toLowerCase(); if (ch === "beta" || ch === "alpha" || ch === "nightly") return ch; return "stable"; }
export function getUpdateChannelUrl(channel: UpdateChannel): string { return "https://updates.coreblow.com/" + channel; }
