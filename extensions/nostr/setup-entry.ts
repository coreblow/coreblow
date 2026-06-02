import { defineSetupPluginEntry } from "coreblow/plugin-sdk/core";
import { nostrSetupPlugin } from "./setup-plugin-api.js";

export default defineSetupPluginEntry(nostrSetupPlugin);
