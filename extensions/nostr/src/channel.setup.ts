import { describeAccountSnapshot } from "coreblow/plugin-sdk/account-helpers";
import { buildChannelConfigSchema, DEFAULT_ACCOUNT_ID, type ChannelPlugin } from "./channel-api.js";
import { NostrConfigSchema } from "./config-schema.js";
import { DEFAULT_RELAYS } from "./default-relays.js";
import { nostrSetupAdapter, nostrSetupWizard } from "./setup-surface.js";
import { resolveNostrAccount, type ResolvedNostrAccount } from "./types.js";

export { nostrSetupAdapter, nostrSetupWizard } from "./setup-surface.js";

export const nostrSetupPlugin: ChannelPlugin<ResolvedNostrAccount> = {
  id: "nostr",
  meta: {
    id: "nostr",
    label: "Nostr",
    selectionLabel: "Nostr",
    docsPath: "/channels/nostr",
    docsLabel: "nostr",
    blurb: "Decentralized DMs via Nostr relays (NIP-04)",
    order: 100,
  },
  capabilities: {
    chatTypes: ["direct"],
    media: false,
  },
  reload: { configPrefixes: ["channels.nostr"] },
  configSchema: buildChannelConfigSchema(NostrConfigSchema),
  setup: nostrSetupAdapter,
  setupWizard: nostrSetupWizard,
  config: {
    listAccountIds: (cfg) => {
      const account = resolveNostrAccount({ cfg });
      return account.configured ? [account.accountId] : [];
    },
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    resolveAccount: (cfg, accountId) => resolveNostrAccount({ cfg, accountId }),
    isConfigured: (account) => account.configured,
    describeAccount: (account) =>
      describeAccountSnapshot({
        account,
        configured: account.configured,
        extra: {
          publicKey: account.publicKey,
          relays: account.relays.length || DEFAULT_RELAYS.length,
        },
      }),
  },
};
