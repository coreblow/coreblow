/** CoreBlow — Plugins Command Helpers */ export function formatPluginInfo(name: string, version: string, enabled: boolean): string { return (enabled ? "✅" : "❌") + " " + name + "@" + version; }
