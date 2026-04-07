/** Runtime plugin loading. */
export interface RuntimePlugin { id: string; name: string; enabled: boolean; }
export function loadRuntimePlugins(): RuntimePlugin[] { return []; /* populated at runtime */ }
