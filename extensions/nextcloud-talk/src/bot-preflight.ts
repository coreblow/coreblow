import { formatErrorMessage } from "coreblow/plugin-sdk/error-runtime";
import { fetchWithSsrFGuard } from "../runtime-api.js";
import type { ResolvedNextcloudTalkAccount } from "./accounts.js";
import { resolveNextcloudTalkApiCredentials } from "./api-credentials.js";

const RESPONSE_FEATURE = 2;

type BotEntry = { id?: string | number; name?: string; url?: string; features?: string | number };

export type NextcloudTalkBotResponseFeatureProbe = {
  ok: boolean;
  skipped?: boolean;
  code:
    | "ok"
    | "missing_api_credentials"
    | "missing_webhook_url"
    | "missing_base_url"
    | "bot_not_found"
    | "missing_response_feature"
    | "api_error"
    | "request_failed";
  message: string;
  botId?: string;
  botName?: string;
  features?: number;
  status?: number;
};

function comparableUrl(value: string | undefined): string {
  if (!value?.trim()) return "";
  try {
    const url = new URL(value.trim());
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim().replace(/\/$/, "");
  }
}

function featureMask(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function probeNextcloudTalkBotResponseFeature(params: {
  account: ResolvedNextcloudTalkAccount;
  timeoutMs?: number;
}): Promise<NextcloudTalkBotResponseFeatureProbe> {
  const { account } = params;
  if (!account.baseUrl) {
    return { ok: false, skipped: true, code: "missing_base_url", message: "Nextcloud Talk base URL is missing." };
  }
  const credentials = resolveNextcloudTalkApiCredentials(account.config);
  if (!credentials) {
    return { ok: false, skipped: true, code: "missing_api_credentials", message: "Nextcloud Talk API credentials are missing." };
  }
  const webhookUrl = comparableUrl(account.config.webhookPublicUrl);
  if (!webhookUrl) {
    return { ok: false, skipped: true, code: "missing_webhook_url", message: "Nextcloud Talk public webhook URL is missing." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs ?? 5_000);
  try {
    const auth = Buffer.from(`${credentials.apiUser}:${credentials.apiPassword}`).toString("base64");
    const { response, release } = await fetchWithSsrFGuard({
      url: `${account.baseUrl}/ocs/v2.php/apps/spreed/api/v1/bot`,
      init: {
        method: "GET",
        headers: { Authorization: `Basic ${auth}`, "OCS-APIRequest": "true", Accept: "application/json" },
        signal: controller.signal,
      },
      auditContext: "nextcloud-talk.bot-preflight",
      policy: account.config.allowPrivateNetwork ? { allowPrivateNetwork: true } : undefined,
    });
    try {
      if (!response.ok) {
        return { ok: false, code: "api_error", status: response.status, message: `Nextcloud Talk bot probe failed (${response.status}).` };
      }
      const payload = (await response.json()) as { ocs?: { data?: BotEntry[] } };
      const bot = (payload.ocs?.data ?? []).find((entry) => comparableUrl(entry.url) === webhookUrl);
      if (!bot) {
        return { ok: false, code: "bot_not_found", message: `No Nextcloud Talk bot uses webhook URL ${webhookUrl}.` };
      }
      const features = featureMask(bot.features);
      if (features == null || (features & RESPONSE_FEATURE) !== RESPONSE_FEATURE) {
        return {
          ok: false,
          code: "missing_response_feature",
          botId: bot.id == null ? undefined : String(bot.id),
          botName: bot.name,
          features,
          message: `Nextcloud Talk bot "${bot.name ?? bot.id ?? "matching bot"}" is missing the response feature; outbound replies will fail.`,
        };
      }
      return { ok: true, code: "ok", botId: bot.id == null ? undefined : String(bot.id), botName: bot.name, features, message: "Nextcloud Talk bot response feature is enabled." };
    } finally {
      await release();
    }
  } catch (error) {
    return { ok: false, code: "request_failed", message: `Nextcloud Talk bot probe failed: ${formatErrorMessage(error)}` };
  } finally {
    clearTimeout(timeout);
  }
}
