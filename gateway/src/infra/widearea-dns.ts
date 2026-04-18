/** CoreBlow — Wide Area DNS */
import { lookup } from "node:dns/promises";
export async function resolveWideAreaDns(hostname: string): Promise<string[]> { try { const results = await lookup(hostname, { all: true }); return results.map((r) => r.address); } catch { return []; } }
