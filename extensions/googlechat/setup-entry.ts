import { defineSetupPluginEntry } from "coreblow/plugin-sdk/core";
import { googlechatPlugin } from "./src/channel.js";

export default defineSetupPluginEntry(googlechatPlugin);
