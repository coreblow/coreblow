/** CoreBlow — Gateway Discovery Targets */
export interface GatewayTarget { host: string; port: number; protocol: "http" | "https"; }
export function resolveGatewayTargets(env: NodeJS.ProcessEnv = process.env): GatewayTarget[] {
  const port = parseInt(env.COREBLOW_PORT ?? "3000", 10);
  return [{ host: "localhost", port, protocol: "http" }];
}
