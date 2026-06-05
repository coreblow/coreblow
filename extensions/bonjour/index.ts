import { definePluginEntry } from "coreblow/plugin-sdk/plugin-entry";

function formatBonjourInstanceName(displayName: string) {
  const trimmed = displayName.trim();
  if (!trimmed) {
    return "CoreBlow";
  }
  if (/coreblow/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed} (CoreBlow)`;
}

export default definePluginEntry({
  id: "bonjour",
  name: "Bonjour Gateway Discovery",
  description: "Advertise the local CoreBlow gateway over Bonjour/mDNS.",
  register(api) {
    const registerGatewayDiscoveryService = (
      api as typeof api & {
        registerGatewayDiscoveryService?: (service: {
          id: string;
          advertise: (ctx: Record<string, unknown>) => Promise<{ stop: () => Promise<void> | void }>;
        }) => void;
      }
    ).registerGatewayDiscoveryService;
    if (!registerGatewayDiscoveryService) {
      api.registerService({
        id: "bonjour",
        start() {},
      });
      return;
    }
    registerGatewayDiscoveryService({
      id: "bonjour",
      advertise: async (ctx) => {
        const [
          { startGatewayBonjourAdvertiser },
          runtime,
        ] = await Promise.all([
          import("./src/advertiser.js"),
          import("coreblow/plugin-sdk/runtime"),
        ]);
        const advertiser = await startGatewayBonjourAdvertiser(
          {
            instanceName: formatBonjourInstanceName(String(ctx.machineDisplayName ?? "CoreBlow")),
            gatewayPort: Number(ctx.gatewayPort ?? 0),
            gatewayTlsEnabled: Boolean(ctx.gatewayTlsEnabled),
            gatewayTlsFingerprintSha256:
              typeof ctx.gatewayTlsFingerprintSha256 === "string"
                ? ctx.gatewayTlsFingerprintSha256
                : undefined,
            gatewayDirectReachable: Boolean(ctx.gatewayDirectReachable),
            canvasPort: typeof ctx.canvasPort === "number" ? ctx.canvasPort : undefined,
            sshPort: typeof ctx.sshPort === "number" ? ctx.sshPort : undefined,
            tailnetDns: typeof ctx.tailnetDns === "string" ? ctx.tailnetDns : undefined,
            cliPath: typeof ctx.cliPath === "string" ? ctx.cliPath : undefined,
            minimal: Boolean(ctx.minimal),
          },
          {
            logger: api.logger,
            registerUncaughtExceptionHandler: (
              "registerUncaughtExceptionHandler" in runtime &&
              typeof runtime.registerUncaughtExceptionHandler === "function"
                ? runtime.registerUncaughtExceptionHandler
                : undefined
            ) as NonNullable<
              Parameters<typeof startGatewayBonjourAdvertiser>[1]
            >["registerUncaughtExceptionHandler"],
            registerUnhandledRejectionHandler: (
              "registerUnhandledRejectionHandler" in runtime &&
              typeof runtime.registerUnhandledRejectionHandler === "function"
                ? runtime.registerUnhandledRejectionHandler
                : undefined
            ) as NonNullable<
              Parameters<typeof startGatewayBonjourAdvertiser>[1]
            >["registerUnhandledRejectionHandler"],
          },
        );
        return { stop: advertiser.stop };
      },
    });
  },
});
