/** CoreBlow — Deliver (Main) */
import { getDeliveryRuntime } from "./deliver-runtime.js";
export interface DeliveryOptions { channelId: string; payload: unknown; retries?: number; }
export async function deliver(opts: DeliveryOptions): Promise<boolean> { const runtime = getDeliveryRuntime(); if (!runtime?.isReady()) return false; let attempts = 0; const maxRetries = opts.retries ?? 2; while (attempts <= maxRetries) { try { return await runtime.send(opts.channelId, opts.payload); } catch { attempts++; } } return false; }
