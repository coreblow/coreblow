/** CoreBlow — Parse Port */ export function parsePort(input: string, defaultPort = 3000): number { const port = parseInt(input, 10); return port > 0 && port <= 65535 ? port : defaultPort; }
