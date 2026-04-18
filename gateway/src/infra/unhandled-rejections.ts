/** CoreBlow — Unhandled Rejections Handler */
let installed = false;
export function installUnhandledRejectionHandler(logger?: Pick<typeof console, "error">): void {
  if (installed) return; installed = true; const log = logger ?? console;
  process.on("unhandledRejection", (reason) => { log.error("[coreblow] Unhandled promise rejection:", reason); });
  process.on("uncaughtException", (err) => { log.error("[coreblow] Uncaught exception:", err); process.exit(1); });
}
export function resetUnhandledRejectionHandler(): void { installed = false; }
