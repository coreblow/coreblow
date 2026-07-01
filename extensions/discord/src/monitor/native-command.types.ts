import type { CoreBlowConfig } from "coreblow/plugin-sdk/config-contracts";
import type { CommandArgValues } from "coreblow/plugin-sdk/native-command-registry";

export type DiscordConfig = NonNullable<CoreBlowConfig["channels"]>["discord"];

export type DiscordCommandArgs = {
  raw?: string;
  values?: CommandArgValues;
};
