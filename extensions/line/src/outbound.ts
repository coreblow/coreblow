import type { ChannelPlugin } from "../runtime-api.js";
import { linePlugin } from "./channel.js";
import type { ResolvedLineAccount } from "./types.js";

export const lineOutboundAdapter: NonNullable<ChannelPlugin<ResolvedLineAccount>["outbound"]> =
  linePlugin.outbound!;
