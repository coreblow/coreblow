export function warn(msg: string): void {
  console.warn(`[WARN] ${msg}`);
}
export function danger(msg: string): void {
  console.error(`[DANGER] ${msg}`);
}
export function info(msg: string): void {
  console.info(`[INFO] ${msg}`);
}
export function shouldLogVerbose(): boolean {
  return false;
}
