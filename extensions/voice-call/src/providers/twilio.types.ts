import type { WebhookSecurityConfig } from "../config.js";

export interface TwilioProviderOptions {
  allowNgrokFreeTierLoopbackBypass?: boolean;
  publicUrl?: string;
  streamPath?: string;
  skipVerification?: boolean;
  webhookSecurity?: WebhookSecurityConfig;
}
