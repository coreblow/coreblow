// @ts-nocheck
import type { ChannelPlugin } from "coreblow/plugin-sdk/core";
import { defineChannelPluginEntry } from "coreblow/plugin-sdk/core";
import { googlechatPlugin } from "./src/channel.js";
import { setGoogleChatRuntime } from "./src/runtime.js";

export { googlechatPlugin } from "./src/channel.js";
export { setGoogleChatRuntime } from "./src/runtime.js";

export default defineChannelPluginEntry({
  id: "googlechat",
  name: "Google Chat",
  description: "CoreBlow Google Chat channel plugin",
  plugin: googlechatPlugin as ChannelPlugin,
  setRuntime: setGoogleChatRuntime,
});
