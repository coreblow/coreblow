import {
  createPatchedAccountSetupAdapter,
  createSetupInputPresenceValidator,
  createTopLevelChannelDmPolicy,
  createDelegatedSetupWizardProxy,
  DEFAULT_ACCOUNT_ID,
  type ChannelSetupWizard,
  type CoreBlowConfig,
} from "coreblow/plugin-sdk/setup";

const channel = "zalo" as const;

export const zaloSetupAdapter = createPatchedAccountSetupAdapter({
  channelKey: channel,
  validateInput: createSetupInputPresenceValidator({
    defaultAccountOnlyEnvError: "ZALO_BOT_TOKEN can only be used for the default account.",
    whenNotUseEnv: [
      {
        someOf: ["token", "tokenFile"],
        message: "Zalo requires token or --token-file (or --use-env).",
      },
    ],
  }),
  buildPatch: (input) =>
    input.useEnv
      ? {}
      : input.tokenFile
        ? { tokenFile: input.tokenFile }
        : input.token
          ? { botToken: input.token }
          : {},
});

export const zaloDmPolicy = createTopLevelChannelDmPolicy({
  label: "Zalo",
  channel,
  policyKey: "channels.zalo.dmPolicy",
  allowFromKey: "channels.zalo.allowFrom",
  getCurrent: (cfg) => (cfg.channels?.zalo?.dmPolicy ?? "pairing") as "pairing",
});

export function createZaloSetupWizardProxy(loadWizard: () => Promise<ChannelSetupWizard>) {
  return createDelegatedSetupWizardProxy({
    channel,
    loadWizard,
    status: {
      configuredLabel: "configured",
      unconfiguredLabel: "needs token",
      configuredHint: "configured",
      unconfiguredHint: "needs Zalo bot token",
      configuredScore: 1,
      unconfiguredScore: 10,
    },
    delegatePrepare: true,
    credentials: [],
    dmPolicy: zaloDmPolicy,
    disable: (cfg: CoreBlowConfig) => ({
      ...cfg,
      channels: {
        ...cfg.channels,
        zalo: {
          ...cfg.channels?.zalo,
          enabled: false,
        },
      },
    }),
  });
}
