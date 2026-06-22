type CompatibilityConfig = { channels?: Record<string, unknown>; [key: string]: unknown };

export const legacyConfigRules = [
  {
    path: "channels.nextcloud-talk.allowPrivateNetwork",
    message: "Move allowPrivateNetwork to network.dangerouslyAllowPrivateNetwork.",
  },
];

export function normalizeCompatibilityConfig(params: { cfg: CompatibilityConfig }): {
  config: CompatibilityConfig;
  changed: boolean;
} {
  const config = structuredClone(params.cfg);
  const channel = config.channels?.["nextcloud-talk"] as Record<string, unknown> | undefined;
  if (!channel) return { config, changed: false };
  let changed = false;
  const migrate = (entry: Record<string, unknown>) => {
    if (typeof entry.allowPrivateNetwork !== "boolean") return;
    const network = (entry.network as Record<string, unknown> | undefined) ?? {};
    entry.network = { ...network, dangerouslyAllowPrivateNetwork: entry.allowPrivateNetwork };
    delete entry.allowPrivateNetwork;
    changed = true;
  };
  migrate(channel);
  const accounts = channel.accounts as Record<string, Record<string, unknown> | undefined> | undefined;
  for (const account of Object.values(accounts ?? {})) if (account) migrate(account);
  return { config, changed };
}
