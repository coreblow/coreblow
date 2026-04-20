import { getChannelPlugin } from "../../channels/plugins/index.js";
import type { ChannelId, ChannelStructuredComponents } from "../../channels/plugins/types.js";
import type { CoreBlowConfig } from "../../config/config.js";

export type CrossContextComponentsBuilder = (message: string) => ChannelStructuredComponents;

export type CrossContextComponentsFactory = (params: {
  originLabel: string;
  message: string;
  cfg: CoreBlowConfig;
  accountId?: string | null;
}) => ChannelStructuredComponents;

export type ChannelMessageAdapter = {
  supportsComponentsV2: boolean;
  buildCrossContextComponents?: CrossContextComponentsFactory;
};

const DEFAULT_ADAPTER: ChannelMessageAdapter = {
  supportsComponentsV2: false,
};

export function getChannelMessageAdapter(channel: ChannelId): ChannelMessageAdapter {
  const adapter = getChannelPlugin(channel)?.messaging?.buildCrossContextComponents;
  if (adapter) {
    return {
      supportsComponentsV2: true,
      buildCrossContextComponents: adapter,
    };
  }
  return DEFAULT_ADAPTER;
}

// ---------------------------------------------------------------------------
// ChannelAdapterService — Tier-1 Standalone Singleton
// ---------------------------------------------------------------------------

import { createTestingHooks } from "../service-patterns.js";

export class ChannelAdapterService {
  getChannelMessageAdapter(channel: ChannelId) {
    return getChannelMessageAdapter(channel);
  }
}

let _adapterInstance: ChannelAdapterService | null = null;

export function getChannelAdapterService(): ChannelAdapterService {
  if (!_adapterInstance) {
    _adapterInstance = new ChannelAdapterService();
  }
  return _adapterInstance;
}

export const __testing_channelAdapter = createTestingHooks<ChannelAdapterService>(
  () => { _adapterInstance = null; },
  (svc) => { _adapterInstance = svc; },
);
