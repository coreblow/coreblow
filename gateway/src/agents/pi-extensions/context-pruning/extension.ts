/** CoreBlow — Context Pruning Extension */ export function createPruningExtension(): { prune: (msgs: unknown[]) => unknown[] } { return { prune: (msgs) => msgs }; }
