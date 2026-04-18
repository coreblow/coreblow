/** CoreBlow — Host Sandbox FS Bridge */ export function createHostFsBridge(): Record<string, Function> { return { read: async () => "", write: async () => {} }; }
