/**
 * hooks/hook-bus.ts — Event bus with wildcard support, filtering, and unsubscribe.
 *
 * Pattern: `type:action` event keys with wildcard (`*`) matching.
 * Supports both exact (`message:received`) and broad (`message:*`, `*`) listeners.
 */

export type HookBusListener = (data: unknown) => Promise<void> | void;

export class HookBus {
  private handlers = new Map<string, HookBusListener[]>();

  /**
   * Subscribe to an event key.
   * Supports exact keys (`message:received`) or wildcards (`message:*`, `*`).
   */
  on(eventKey: string, fn: HookBusListener): void {
    const list = this.handlers.get(eventKey) ?? [];
    list.push(fn);
    this.handlers.set(eventKey, list);
  }

  /**
   * Unsubscribe a specific listener from an event key.
   */
  off(eventKey: string, fn: HookBusListener): boolean {
    const list = this.handlers.get(eventKey);
    if (!list) return false;
    const idx = list.indexOf(fn);
    if (idx === -1) return false;
    list.splice(idx, 1);
    if (list.length === 0) this.handlers.delete(eventKey);
    return true;
  }

  /**
   * Fire an event. Resolves matching listeners in this order:
   *   1. Exact match (`message:received`)
   *   2. Type wildcard (`message:*`)
   *   3. Global wildcard (`*`)
   *
   * Errors in individual listeners are caught and do not block subsequent listeners.
   */
  async fire(eventKey: string, data: unknown): Promise<void> {
    const listeners = this.resolveListeners(eventKey);
    for (const fn of listeners) {
      try {
        await fn(data);
      } catch {
        // Swallow — fire-and-forget semantics
      }
    }
  }

  /**
   * Check if any listeners exist for a given event key (including wildcards).
   */
  hasListeners(eventKey: string): boolean {
    return this.resolveListeners(eventKey).length > 0;
  }

  /**
   * Return all registered event keys.
   */
  keys(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Remove all listeners.
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * Return listener count for a specific key (exact, no wildcard expansion).
   */
  listenerCount(eventKey: string): number {
    return this.handlers.get(eventKey)?.length ?? 0;
  }

  // ─── Private ──────────────────────────────────────────────────────

  private resolveListeners(eventKey: string): HookBusListener[] {
    const exact = this.handlers.get(eventKey) ?? [];
    const [type] = eventKey.split(":");
    const typeWildcard = type ? (this.handlers.get(`${type}:*`) ?? []) : [];
    const globalWildcard = this.handlers.get("*") ?? [];
    return [...exact, ...typeWildcard, ...globalWildcard];
  }
}
