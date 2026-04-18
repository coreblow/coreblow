/** CoreBlow — Plugins Config */ export function resolvePluginsDir(): string { return process.env.COREBLOW_PLUGINS_DIR || "~/.coreblow/plugins"; }
