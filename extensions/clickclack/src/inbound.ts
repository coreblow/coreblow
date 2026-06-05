import type { ClickClackMessage, CoreConfig, ResolvedClickClackAccount } from "./types.js";

export async function handleClickClackInbound(_params: {
  account: ResolvedClickClackAccount;
  config: CoreConfig;
  message: ClickClackMessage;
}): Promise<void> {
  // Full ClickClack turn dispatch depends on CoreBlow channel runtime slots that
  // are intentionally not activated in this P3 registry facade batch.
}
