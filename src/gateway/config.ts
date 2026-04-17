/** Gateway Config */
export interface GatewayConfig {
    port?: number;
    host?: string;
    cors?: boolean;
    maxConnections?: number;
    timeout?: number;
    auth?: { enabled: boolean; secret?: string };
}
import { DEFAULT_GATEWAY_PORT } from '../infra/port-finder.js';
export const defaultGatewayConfig: GatewayConfig = { port: DEFAULT_GATEWAY_PORT, host: '0.0.0.0', cors: true, maxConnections: 100, timeout: 30000 };
export function resolveGatewayConfig(partial?: Partial<GatewayConfig>): GatewayConfig { return { ...defaultGatewayConfig, ...partial }; }


export interface HttpCommon { headers?: Record<string, string>; timeout?: number; }
