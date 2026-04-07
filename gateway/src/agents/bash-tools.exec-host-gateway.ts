/** Exec host — gateway mode. */
export { execCommand } from './bash-tools.js';
export type ExecHostMode = 'gateway';
export function isGatewayMode(): boolean { return true; }
