import type { CoreBlowConfig } from "coreblow/plugin-sdk/config-runtime";

export type SignalAccountConfig = Omit<
  Exclude<NonNullable<CoreBlowConfig["channels"]>["signal"], undefined>,
  "accounts"
>;
