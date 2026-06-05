import type { ChannelPlugin } from "coreblow/plugin-sdk/channel-core";
import { createChatChannelPlugin } from "coreblow/plugin-sdk/channel-core";
import { clickClackConfigSchema } from "./config-schema.js";
import type { ResolvedClickClackAccount } from "./types.js";

export const clickClackPlugin: ChannelPlugin<ResolvedClickClackAccount> = createChatChannelPlugin({
  base: {
    id: "clickclack",
    meta: {
      label: "ClickClack",
      docsPath: "/channels/clickclack",
    },
    configSchema: clickClackConfigSchema,
  },
});
