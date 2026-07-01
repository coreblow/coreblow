import { logVerbose } from "coreblow/plugin-sdk/runtime-env";
import type { PluralKitMessageInfo } from "../pluralkit.js";
import { isPreflightAborted, loadPluralKitRuntime } from "./message-handler.preflight-runtime.js";

export async function resolveDiscordPreflightPluralKitInfo(params: {
  message: { id: string };
  config?: NonNullable<
    NonNullable<
      import("coreblow/plugin-sdk/config-contracts").CoreBlowConfig["channels"]
    >["discord"]
  >["pluralkit"];
  abortSignal?: AbortSignal;
}): Promise<PluralKitMessageInfo | null> {
  if (!params.config?.enabled) {
    return null;
  }
  try {
    const { fetchPluralKitMessageInfo } = await loadPluralKitRuntime();
    const info = await fetchPluralKitMessageInfo({
      messageId: params.message.id,
      config: params.config,
    });
    return isPreflightAborted(params.abortSignal) ? null : info;
  } catch (err) {
    logVerbose(`discord: pluralkit lookup failed for ${params.message.id}: ${String(err)}`);
    return null;
  }
}
