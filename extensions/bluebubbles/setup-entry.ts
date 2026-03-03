import { defineSetupPluginEntry } from "coreblow/plugin-sdk/core";
import { bluebubblesSetupPlugin } from "./src/channel.setup.js";

export { bluebubblesSetupPlugin } from "./src/channel.setup.js";

export default defineSetupPluginEntry(bluebubblesSetupPlugin);
