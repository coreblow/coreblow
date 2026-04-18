/** CoreBlow — Network Interfaces */
import os from "node:os";
export interface NetworkAddress { name: string; address: string; family: "IPv4" | "IPv6"; internal: boolean; }
export function getNetworkAddresses(): NetworkAddress[] { const ifaces = os.networkInterfaces(); const result: NetworkAddress[] = []; for (const [name, addrs] of Object.entries(ifaces)) { if (!addrs) continue; for (const a of addrs) result.push({ name, address: a.address, family: a.family as "IPv4" | "IPv6", internal: a.internal }); } return result; }
export function getExternalIpv4(): string | null { return getNetworkAddresses().find((a) => a.family === "IPv4" && !a.internal)?.address ?? null; }
