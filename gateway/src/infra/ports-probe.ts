/** CoreBlow — Ports Probe */
import net from "node:net";
export function isPortAvailable(port: number, host = "127.0.0.1"): Promise<boolean> { return new Promise((resolve) => { const s = net.createServer(); s.once("error", () => resolve(false)); s.listen(port, host, () => { s.close(() => resolve(true)); }); }); }
