/** CoreBlow — Matrix Plugin Helper */ export function isMatrixPluginAvailable(): boolean { try { require.resolve("matrix-js-sdk"); return true; } catch { return false; } }
