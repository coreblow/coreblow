/** CoreBlow — Control UI Shared */ export const CONTROL_UI_PREFIX = "/_control"; export function isControlUiPath(path: string): boolean { return path.startsWith(CONTROL_UI_PREFIX) || path === "/"; }
