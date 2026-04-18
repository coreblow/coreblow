/** CoreBlow — Config Prototype Keys Guard */
const BLOCKED = new Set(["__proto__", "constructor", "prototype"]);
export function hasPrototypeKey(obj: Record<string, unknown>): boolean { return Object.keys(obj).some((k) => BLOCKED.has(k)); }
export function stripPrototypeKeys(obj: Record<string, unknown>): Record<string, unknown> { const r = { ...obj }; for (const k of BLOCKED) delete r[k]; return r; }
