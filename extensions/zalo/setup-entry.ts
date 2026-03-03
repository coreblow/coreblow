import { defineSetupPluginEntry } from "coreblow/plugin-sdk/core";
import { zaloPlugin } from "./src/channel.js";

export default defineSetupPluginEntry(zaloPlugin);
