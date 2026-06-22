import { listNextcloudTalkAccountIds, resolveNextcloudTalkAccount } from "./accounts.js";
import { probeNextcloudTalkBotResponseFeature } from "./bot-preflight.js";
import { legacyConfigRules, normalizeCompatibilityConfig } from "./doctor-contract.js";
import type { CoreConfig } from "./types.js";

export const nextcloudTalkDoctor = {
  legacyConfigRules,
  normalizeCompatibilityConfig,
  collectPreviewWarnings: async ({ cfg }: { cfg: CoreConfig }): Promise<string[]> => {
    const warnings: string[] = [];
    for (const accountId of listNextcloudTalkAccountIds(cfg)) {
      const account = resolveNextcloudTalkAccount({ cfg, accountId });
      if (!account.enabled || !account.secret || !account.baseUrl) continue;
      const result = await probeNextcloudTalkBotResponseFeature({ account, timeoutMs: 5_000 });
      if (["missing_response_feature", "bot_not_found", "api_error", "request_failed"].includes(result.code)) {
        warnings.push(`- channels.nextcloud-talk.${account.accountId}: ${result.message}`);
      }
    }
    return warnings;
  },
};
