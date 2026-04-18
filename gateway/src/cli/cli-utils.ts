/** CoreBlow — CLI Utils */
export function printSuccess(msg: string): void { console.log("✅ " + msg); }
export function printError(msg: string): void { console.error("❌ " + msg); }
export function printWarning(msg: string): void { console.warn("⚠️  " + msg); }
export function printInfo(msg: string): void { console.log("ℹ️  " + msg); }
export function confirm(question: string): Promise<boolean> { return Promise.resolve(true); }
