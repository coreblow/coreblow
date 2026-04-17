export function resolveGatewayPort(cfgPort?: number): number {
    if (cfgPort && cfgPort > 0 && cfgPort < 65536) {
        return cfgPort;
    }
    const envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : NaN;
    if (!isNaN(envPort) && envPort > 0 && envPort < 65536) {
        return envPort;
    }
    return 3000;
}

export function formatUptime(ms: number): string {
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);

    if (day > 0) return `${day}d ${hr % 24}h`;
    if (hr > 0) return `${hr}h ${min % 60}m`;
    if (min > 0) return `${min}m ${sec % 60}s`;
    return `${sec}s`;
}
