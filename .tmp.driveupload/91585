/** agents/trace-base.ts — Base trace/span types for observability. */
export interface TraceSpan { traceId: string; spanId: string; parentSpanId?: string; name: string; startTime: number; endTime?: number; attributes?: Record<string, unknown>; }
export function createSpan(name: string, traceId?: string): TraceSpan { return { traceId: traceId ?? `tr_${Date.now().toString(36)}`, spanId: `sp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, name, startTime: Date.now() }; }
export function endSpan(span: TraceSpan): TraceSpan { span.endTime = Date.now(); return span; }
export function spanDurationMs(span: TraceSpan): number { return (span.endTime ?? Date.now()) - span.startTime; }
