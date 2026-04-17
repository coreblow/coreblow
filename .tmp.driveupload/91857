export function logInfo(message: string): void {
  console.info(`[INFO] ${message}`);
}
export function logWarn(message: string): void {
  console.warn(`[WARN] ${message}`);
}
export function logError(message: string): void {
  console.error(`[ERROR] ${message}`);
}
export function logDebug(message: string): void {
  if (process.env.COREBLOW_DEBUG === "1" || process.env.DEBUG === "1") {
    console.debug(`[DEBUG] ${message}`);
  }
}
export function logSuccess(message: string): void {
  console.log(`[OK] ${message}`);
}
