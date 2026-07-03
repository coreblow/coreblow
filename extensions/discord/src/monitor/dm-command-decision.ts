import { createChannelPairingChallengeIssuer } from "coreblow/plugin-sdk/channel-pairing";
import { upsertChannelPairingRequest } from "coreblow/plugin-sdk/conversation-runtime";
import type { ResolvedChannelMessageIngress } from "coreblow/plugin-sdk/channel-ingress-runtime";

export async function handleDiscordDmCommandDecision(params: {
  senderAccess: Pick<ResolvedChannelMessageIngress["senderAccess"], "decision">;
  accountId: string;
  sender: {
    id: string;
    tag?: string;
    name?: string;
  };
  onPairingCreated: (code: string) => Promise<void>;
  onUnauthorized: () => Promise<void>;
  upsertPairingRequest?: typeof upsertChannelPairingRequest;
}): Promise<boolean> {
  if (params.senderAccess.decision === "allow") {
    return true;
  }

  if (params.senderAccess.decision === "pairing") {
    const upsertPairingRequest = params.upsertPairingRequest ?? upsertChannelPairingRequest;
    const result = await createChannelPairingChallengeIssuer({
      channel: "discord",
      upsertPairingRequest: async ({ id, meta }) =>
        await upsertPairingRequest({
          channel: "discord",
          id,
          accountId: params.accountId,
          meta,
        }),
    })({
      senderId: params.sender.id,
      senderIdLine: `Your Discord user id: ${params.sender.id}`,
      meta: {
        tag: params.sender.tag,
        name: params.sender.name,
      },
      sendPairingReply: async () => {},
    });
    if (result.created && result.code) {
      await params.onPairingCreated(result.code);
    }
    return false;
  }

  await params.onUnauthorized();
  return false;
}
