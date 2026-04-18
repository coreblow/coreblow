/** CoreBlow — HTTP Listen */ export interface ListenOptions { port: number; host: string; } export function formatListenAddress(opts: ListenOptions): string { return opts.host + ":" + opts.port; }
