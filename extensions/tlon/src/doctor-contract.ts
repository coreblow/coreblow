type CompatibilityConfigParams = {
  cfg: {
    channels?: {
      tlon?: Record<string, unknown> & {
        accounts?: Record<string, Record<string, unknown>>;
      };
    };
  };
};

function migrateTlonConfig(input: Record<string, unknown>): Record<string, unknown> {
  if (!Object.hasOwn(input, "allowPrivateNetwork")) {
    return input;
  }
  const allowPrivateNetwork = input.allowPrivateNetwork;
  if (typeof allowPrivateNetwork !== "boolean") {
    return input;
  }
  const next = { ...input };
  delete next.allowPrivateNetwork;
  next.network = {
    ...((typeof input.network === "object" && input.network) || {}),
    dangerouslyAllowPrivateNetwork: allowPrivateNetwork,
  };
  return next;
}

export const legacyConfigRules = [
  {
    path: "channels.tlon.allowPrivateNetwork",
    replacement: "channels.tlon.network.dangerouslyAllowPrivateNetwork",
  },
  {
    path: "channels.tlon.accounts.*.allowPrivateNetwork",
    replacement: "channels.tlon.accounts.*.network.dangerouslyAllowPrivateNetwork",
  },
];

export function normalizeCompatibilityConfig(params: CompatibilityConfigParams): {
  config: CompatibilityConfigParams["cfg"];
} {
  const tlon = params.cfg.channels?.tlon;
  if (!tlon) {
    return { config: params.cfg };
  }

  const accounts = tlon.accounts
    ? Object.fromEntries(
        Object.entries(tlon.accounts).map(([accountId, accountConfig]) => [
          accountId,
          migrateTlonConfig(accountConfig),
        ]),
      )
    : undefined;
  return {
    config: {
      ...params.cfg,
      channels: {
        ...params.cfg.channels,
        tlon: {
          ...migrateTlonConfig(tlon),
          ...(accounts ? { accounts } : {}),
        },
      },
    },
  };
}
