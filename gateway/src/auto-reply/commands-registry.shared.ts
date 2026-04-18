/** CoreBlow — Commands Registry Shared */ export const COMMAND_PREFIX = "/"; export function isCommand(text: string): boolean { return text.startsWith(COMMAND_PREFIX); }
