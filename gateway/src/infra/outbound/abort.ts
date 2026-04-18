/** CoreBlow — Outbound Abort */
export class OutboundAbortError extends Error { constructor(msg = "Outbound delivery aborted") { super(msg); this.name = "OutboundAbortError"; } }
export function createAbortController(timeoutMs?: number): { controller: AbortController; cleanup: () => void } {
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | null = null;
  if (timeoutMs && timeoutMs > 0) timer = setTimeout(() => controller.abort(new OutboundAbortError("timeout")), timeoutMs);
  return { controller, cleanup: () => { if (timer) clearTimeout(timer); } };
}
