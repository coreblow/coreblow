/** CoreBlow — Remote FS Bridge */ export function createRemoteFsBridge(url: string): Record<string, Function> { return { read: async () => "", write: async () => {} }; }
