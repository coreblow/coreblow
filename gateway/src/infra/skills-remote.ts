/** CoreBlow — Skills Remote Registry */
export interface RemoteSkill { name: string; description: string; version: string; url: string; }
export async function fetchRemoteSkills(registryUrl: string): Promise<RemoteSkill[]> { try { const r = await fetch(registryUrl + "/skills", { signal: AbortSignal.timeout(10000) }); return r.ok ? await r.json() as RemoteSkill[] : []; } catch { return []; } }
