/** CoreBlow — SSH Tunnel */
export interface TunnelConfig { localPort: number; remoteHost: string; remotePort: number; sshHost: string; sshUser?: string; }
export function buildSshTunnelCommand(config: TunnelConfig): string { const user = config.sshUser ? config.sshUser + "@" : ""; return "ssh -L " + config.localPort + ":" + config.remoteHost + ":" + config.remotePort + " " + user + config.sshHost + " -N"; }
