import type { CoreBlowConfig, GatewayLogger } from "./gateway-types.js";

export function logGatewayStartupDiagnostics(log: GatewayLogger, cfg: CoreBlowConfig, port: number) {
    log.info(`====================================================`);
    log.info(`CoreBlow Gateway Starting...`);
    log.info(`Port: ${port}`);
    log.info(`Auth Mode: ${cfg?.gateway?.auth?.token ? "token" : cfg?.gateway?.auth?.password ? "password" : "none"}`);
    
    // Log Node Version
    log.info(`Node.js Version: ${process.version}`);
    
    // Log process memory limitation config if present
    const maxOldSpace = process.execArgv.find(arg => arg.startsWith('--max-old-space-size='));
    log.info(`V8 Memory Limit: ${maxOldSpace ? maxOldSpace.split('=')[1] + 'MB' : 'Default'}`);
    log.info(`====================================================`);
}
