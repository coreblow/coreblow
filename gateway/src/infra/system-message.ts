/** CoreBlow — System Message */
export function formatSystemMessage(message: string): string { return "[coreblow:system] " + message; }
export function isSystemMessage(text: string): boolean { return text.startsWith("[coreblow:system]"); }
