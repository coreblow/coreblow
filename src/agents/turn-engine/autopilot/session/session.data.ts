/**
 * CoreBlow AutoPilot — session store
 */
import type { SessionState } from './types.js';
export const sessions = new Map<string, SessionState>();
