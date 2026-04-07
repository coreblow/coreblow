import type { DiscordMessage } from '../types-sdk.js';
import type { ResolvedConfig } from '../config.js';

export function checkPermissions(_message: DiscordMessage, _config: ResolvedConfig): { allowed: boolean } { return { allowed: true }; }