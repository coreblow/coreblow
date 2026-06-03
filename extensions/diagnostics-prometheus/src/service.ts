import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  DiagnosticEventPayload,
  CoreBlowPluginHttpRouteHandler,
  CoreBlowPluginService,
} from "../api.js";
import { onDiagnosticEvent, redactSensitiveText } from "../api.js";

type LabelSet = Record<string, string>;

type CounterSample = {
  help: string;
  labels: LabelSet;
  value: number;
};

type GaugeSample = {
  help: string;
  labels: LabelSet;
  value: number;
};

type HistogramSample = {
  help: string;
  labels: LabelSet;
  buckets: number[];
  counts: number[];
  count: number;
  sum: number;
};

type MetricSnapshot = {
  counters: Map<string, CounterSample>;
  gauges: Map<string, GaugeSample>;
  histograms: Map<string, HistogramSample>;
};

type PrometheusMetricStore = ReturnType<typeof createPrometheusMetricStore>;

const DURATION_BUCKETS_SECONDS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300, 600,
];
const TOKEN_BUCKETS = [1, 4, 16, 64, 256, 1024, 4096, 16384, 65536, 262144, 1048576];
const BYTE_BUCKETS = [
  1024, 4096, 16384, 65536, 262144, 1048576, 4194304, 16777216, 67108864, 268435456, 1073741824,
];
const LOW_CARDINALITY_VALUE_RE = /^[A-Za-z0-9_.:-]{1,120}$/u;
const MAX_PROMETHEUS_SERIES = 2048;
const DROPPED_SERIES_COUNTER_NAME = "coreblow_prometheus_series_dropped_total";

function lowCardinalityLabel(value: string | number | undefined, fallback = "unknown"): string {
  if (value === undefined || value === null) {
    return fallback;
  }
  const redacted = redactSensitiveText(String(value).trim());
  return LOW_CARDINALITY_VALUE_RE.test(redacted) ? redacted : fallback;
}

function numericValue(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function seconds(ms: number | undefined): number | undefined {
  const value = numericValue(ms);
  return value === undefined ? undefined : value / 1000;
}

function sortedLabels(labels: LabelSet): [string, string][] {
  return Object.entries(labels).toSorted(([left], [right]) => left.localeCompare(right));
}

function metricKey(name: string, labels: LabelSet): string {
  return `${name}|${JSON.stringify(sortedLabels(labels))}`;
}

function escapeHelp(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n");
}

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}

function formatLabels(labels: LabelSet): string {
  const entries = sortedLabels(labels);
  if (entries.length === 0) {
    return "";
  }
  return `{${entries.map(([key, value]) => `${key}="${escapeLabelValue(value)}"`).join(",")}}`;
}

function formatPrometheusNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(12)));
}

function createPrometheusMetricStore() {
  const counters = new Map<string, CounterSample>();
  const gauges = new Map<string, GaugeSample>();
  const histograms = new Map<string, HistogramSample>();
  let droppedSeries = 0;

  const canCreateSeries = <T>(map: Map<string, T>, key: string, metricName: string): boolean => {
    if (map.has(key)) {
      return true;
    }
    if (metricName === DROPPED_SERIES_COUNTER_NAME) {
      return true;
    }
    if (counters.size + gauges.size + histograms.size < MAX_PROMETHEUS_SERIES) {
      return true;
    }
    droppedSeries += 1;
    return false;
  };

  const counter = (name: string, help: string, labels: LabelSet, amount = 1) => {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    const key = metricKey(name, labels);
    if (!canCreateSeries(counters, key, name)) {
      return;
    }
    const existing = counters.get(key);
    if (existing) {
      existing.value += amount;
      return;
    }
    counters.set(key, { help, labels, value: amount });
  };

  const gauge = (name: string, help: string, labels: LabelSet, value: number | undefined) => {
    if (value === undefined || !Number.isFinite(value)) {
      return;
    }
    const key = metricKey(name, labels);
    if (!canCreateSeries(gauges, key, name)) {
      return;
    }
    gauges.set(key, { help, labels, value });
  };

  const histogram = (
    name: string,
    help: string,
    labels: LabelSet,
    value: number | undefined,
    buckets = DURATION_BUCKETS_SECONDS,
  ) => {
    if (value === undefined || !Number.isFinite(value) || value < 0) {
      return;
    }
    const key = metricKey(name, labels);
    if (!canCreateSeries(histograms, key, name)) {
      return;
    }
    let sample = histograms.get(key);
    if (!sample) {
      sample = {
        help,
        labels,
        buckets,
        counts: buckets.map(() => 0),
        count: 0,
        sum: 0,
      };
      histograms.set(key, sample);
    }
    sample.count += 1;
    sample.sum += value;
    for (let index = 0; index < sample.buckets.length; index += 1) {
      const bucket = sample.buckets[index];
      if (bucket !== undefined && value <= bucket) {
        sample.counts[index] = (sample.counts[index] ?? 0) + 1;
      }
    }
  };

  const snapshot = (): MetricSnapshot => {
    const counterSnapshot = new Map(counters);
    if (droppedSeries > 0) {
      counterSnapshot.set(metricKey(DROPPED_SERIES_COUNTER_NAME, {}), {
        help: "Prometheus metric series dropped because the exporter series cap was reached.",
        labels: {},
        value: droppedSeries,
      });
    }
    return {
      counters: counterSnapshot,
      gauges: new Map(gauges),
      histograms: new Map(histograms),
    };
  };

  const reset = () => {
    counters.clear();
    gauges.clear();
    histograms.clear();
    droppedSeries = 0;
  };

  return { counter, gauge, histogram, snapshot, reset };
}

function renderPrometheusMetrics(store: PrometheusMetricStore): string {
  const snapshot = store.snapshot();
  const lines: string[] = [];

  const pushCounter = (name: string, sample: CounterSample) => {
    lines.push(`# HELP ${name} ${escapeHelp(sample.help)}`);
    lines.push(`# TYPE ${name} counter`);
    lines.push(`${name}${formatLabels(sample.labels)} ${formatPrometheusNumber(sample.value)}`);
  };

  const pushGauge = (name: string, sample: GaugeSample) => {
    lines.push(`# HELP ${name} ${escapeHelp(sample.help)}`);
    lines.push(`# TYPE ${name} gauge`);
    lines.push(`${name}${formatLabels(sample.labels)} ${formatPrometheusNumber(sample.value)}`);
  };

  const pushHistogram = (name: string, sample: HistogramSample) => {
    lines.push(`# HELP ${name} ${escapeHelp(sample.help)}`);
    lines.push(`# TYPE ${name} histogram`);
    let cumulative = 0;
    for (let index = 0; index < sample.buckets.length; index += 1) {
      cumulative += sample.counts[index] ?? 0;
      lines.push(
        `${name}_bucket${formatLabels({ ...sample.labels, le: String(sample.buckets[index]) })} ${formatPrometheusNumber(cumulative)}`,
      );
    }
    lines.push(`${name}_bucket${formatLabels({ ...sample.labels, le: "+Inf" })} ${formatPrometheusNumber(sample.count)}`);
    lines.push(`${name}_sum${formatLabels(sample.labels)} ${formatPrometheusNumber(sample.sum)}`);
    lines.push(`${name}_count${formatLabels(sample.labels)} ${formatPrometheusNumber(sample.count)}`);
  };

  for (const [key, sample] of snapshot.counters) {
    const [name] = key.split("|", 1);
    if (name) {
      pushCounter(name, sample);
    }
  }
  for (const [key, sample] of snapshot.gauges) {
    const [name] = key.split("|", 1);
    if (name) {
      pushGauge(name, sample);
    }
  }
  for (const [key, sample] of snapshot.histograms) {
    const [name] = key.split("|", 1);
    if (name) {
      pushHistogram(name, sample);
    }
  }
  return lines.join("\n");
}

function recordDiagnosticEvent(store: PrometheusMetricStore, event: DiagnosticEventPayload): void {
  switch (event.type) {
    case "model.usage": {
      const labels = {
        channel: lowCardinalityLabel(event.channel, "none"),
        provider: lowCardinalityLabel(event.provider, "none"),
        model: lowCardinalityLabel(event.model, "none"),
      };
      store.counter(
        "coreblow_model_usage_total",
        "Model usage events by provider/model.",
        labels,
      );
      store.histogram(
        "coreblow_model_duration_seconds",
        "Model usage duration in seconds.",
        labels,
        seconds(event.durationMs),
      );
      store.histogram(
        "coreblow_model_tokens_total",
        "Model token usage buckets.",
        { ...labels, token_type: "total" },
        numericValue(event.usage.total),
        TOKEN_BUCKETS,
      );
      store.histogram(
        "coreblow_model_cost_usd",
        "Estimated model cost in USD.",
        labels,
        numericValue(event.costUsd),
      );
      break;
    }
    case "webhook.received":
      store.counter(
        "coreblow_webhook_received_total",
        "Webhook receives by channel and update type.",
        {
          channel: lowCardinalityLabel(event.channel),
          update_type: lowCardinalityLabel(event.updateType, "none"),
        },
      );
      break;
    case "webhook.processed":
      store.counter(
        "coreblow_webhook_processed_total",
        "Webhook completions by channel and update type.",
        {
          channel: lowCardinalityLabel(event.channel),
          update_type: lowCardinalityLabel(event.updateType, "none"),
        },
      );
      store.histogram(
        "coreblow_webhook_duration_seconds",
        "Webhook processing duration in seconds.",
        {
          channel: lowCardinalityLabel(event.channel),
          update_type: lowCardinalityLabel(event.updateType, "none"),
        },
        seconds(event.durationMs),
      );
      break;
    case "webhook.error":
      store.counter(
        "coreblow_webhook_error_total",
        "Webhook errors by channel and update type.",
        {
          channel: lowCardinalityLabel(event.channel),
          update_type: lowCardinalityLabel(event.updateType, "none"),
        },
      );
      break;
    case "message.queued":
      store.counter(
        "coreblow_message_queued_total",
        "Queued inbound messages by source and channel.",
        {
          source: lowCardinalityLabel(event.source),
          channel: lowCardinalityLabel(event.channel, "none"),
        },
      );
      store.gauge(
        "coreblow_message_queue_depth",
        "Latest observed inbound queue depth.",
        { source: lowCardinalityLabel(event.source) },
        numericValue(event.queueDepth),
      );
      break;
    case "message.processed":
      store.counter(
        "coreblow_message_processed_total",
        "Processed messages by outcome.",
        {
          channel: lowCardinalityLabel(event.channel),
          outcome: lowCardinalityLabel(event.outcome),
          reason: lowCardinalityLabel(event.reason, "none"),
        },
      );
      store.histogram(
        "coreblow_message_duration_seconds",
        "Message processing duration in seconds.",
        {
          channel: lowCardinalityLabel(event.channel),
          outcome: lowCardinalityLabel(event.outcome),
        },
        seconds(event.durationMs),
      );
      break;
    case "session.state":
      store.counter(
        "coreblow_session_state_total",
        "Session state transitions.",
        {
          state: lowCardinalityLabel(event.state),
          prev_state: lowCardinalityLabel(event.prevState, "none"),
          reason: lowCardinalityLabel(event.reason, "none"),
        },
      );
      store.gauge(
        "coreblow_session_queue_depth",
        "Latest observed session queue depth.",
        { state: lowCardinalityLabel(event.state) },
        numericValue(event.queueDepth),
      );
      break;
    case "session.stuck":
      store.counter(
        "coreblow_session_stuck_total",
        "Sessions detected as stuck.",
        { state: lowCardinalityLabel(event.state) },
      );
      store.histogram(
        "coreblow_session_stuck_age_seconds",
        "Age of stuck sessions in seconds.",
        { state: lowCardinalityLabel(event.state) },
        seconds(event.ageMs),
      );
      break;
    case "queue.lane.enqueue":
      store.counter(
        "coreblow_queue_lane_enqueue_total",
        "Queue lane enqueue events.",
        { lane: lowCardinalityLabel(event.lane) },
      );
      store.gauge(
        "coreblow_queue_lane_depth",
        "Latest observed queue lane depth.",
        { lane: lowCardinalityLabel(event.lane) },
        numericValue(event.queueSize),
      );
      break;
    case "queue.lane.dequeue":
      store.counter(
        "coreblow_queue_lane_dequeue_total",
        "Queue lane dequeue events.",
        { lane: lowCardinalityLabel(event.lane) },
      );
      store.gauge(
        "coreblow_queue_lane_depth",
        "Latest observed queue lane depth.",
        { lane: lowCardinalityLabel(event.lane) },
        numericValue(event.queueSize),
      );
      store.histogram(
        "coreblow_queue_lane_wait_seconds",
        "Queue lane wait duration in seconds.",
        { lane: lowCardinalityLabel(event.lane) },
        seconds(event.waitMs),
      );
      break;
    case "run.attempt":
      store.counter(
        "coreblow_run_attempt_total",
        "Run attempts by attempt number.",
        { attempt: lowCardinalityLabel(event.attempt, "0") },
      );
      break;
    case "diagnostic.heartbeat":
      store.gauge("coreblow_diagnostics_active", "Active sessions seen by diagnostics heartbeat.", {}, numericValue(event.active));
      store.gauge("coreblow_diagnostics_waiting", "Waiting sessions seen by diagnostics heartbeat.", {}, numericValue(event.waiting));
      store.gauge("coreblow_diagnostics_queued", "Queued sessions seen by diagnostics heartbeat.", {}, numericValue(event.queued));
      store.gauge("coreblow_diagnostics_webhooks_received", "Webhook receives in the last heartbeat window.", {}, numericValue(event.webhooks.received));
      store.gauge("coreblow_diagnostics_webhooks_processed", "Webhook completions in the last heartbeat window.", {}, numericValue(event.webhooks.processed));
      store.gauge("coreblow_diagnostics_webhooks_errors", "Webhook errors in the last heartbeat window.", {}, numericValue(event.webhooks.errors));
      break;
    case "tool.loop":
      store.counter(
        "coreblow_tool_loop_total",
        "Tool loop detections.",
        {
          tool: lowCardinalityLabel(event.toolName, "tool"),
          level: lowCardinalityLabel(event.level),
          action: lowCardinalityLabel(event.action),
          detector: lowCardinalityLabel(event.detector),
          paired_tool: lowCardinalityLabel(event.pairedToolName, "none"),
        },
      );
      store.gauge(
        "coreblow_tool_loop_count",
        "Latest observed loop counter for a tool.",
        {
          tool: lowCardinalityLabel(event.toolName, "tool"),
          detector: lowCardinalityLabel(event.detector),
        },
        numericValue(event.count),
      );
      break;
    case "diagnostic.memory.sample":
      store.gauge("coreblow_memory_rss_bytes", "Resident memory usage in bytes.", {}, numericValue(event.memory.rssBytes));
      store.gauge("coreblow_memory_heap_total_bytes", "Heap total bytes.", {}, numericValue(event.memory.heapTotalBytes));
      store.gauge("coreblow_memory_heap_used_bytes", "Heap used bytes.", {}, numericValue(event.memory.heapUsedBytes));
      store.gauge("coreblow_memory_external_bytes", "External memory bytes.", {}, numericValue(event.memory.externalBytes));
      store.gauge("coreblow_memory_array_buffers_bytes", "Array buffer memory bytes.", {}, numericValue(event.memory.arrayBuffersBytes));
      store.gauge("coreblow_uptime_seconds", "Process uptime in seconds.", {}, seconds(event.uptimeMs));
      break;
    case "diagnostic.memory.pressure":
      store.counter(
        "coreblow_memory_pressure_total",
        "Memory pressure events.",
        {
          level: lowCardinalityLabel(event.level),
          reason: lowCardinalityLabel(event.reason),
        },
      );
      store.histogram(
        "coreblow_memory_pressure_threshold_bytes",
        "Memory pressure thresholds in bytes.",
        {
          level: lowCardinalityLabel(event.level),
          reason: lowCardinalityLabel(event.reason),
        },
        numericValue(event.thresholdBytes),
        BYTE_BUCKETS,
      );
      break;
    case "payload.large":
      store.counter(
        "coreblow_payload_large_total",
        "Large payload events.",
        {
          surface: lowCardinalityLabel(event.surface),
          action: lowCardinalityLabel(event.action),
          channel: lowCardinalityLabel(event.channel, "none"),
          plugin_id: lowCardinalityLabel(event.pluginId, "none"),
          reason: lowCardinalityLabel(event.reason, "none"),
        },
      );
      store.histogram(
        "coreblow_payload_bytes",
        "Payload bytes for large-payload events.",
        {
          surface: lowCardinalityLabel(event.surface),
          action: lowCardinalityLabel(event.action),
        },
        numericValue(event.bytes),
        BYTE_BUCKETS,
      );
      break;
  }
}

export function createDiagnosticsPrometheusExporter(): {
  service: CoreBlowPluginService;
  handler: CoreBlowPluginHttpRouteHandler;
} {
  const store = createPrometheusMetricStore();
  let unsubscribe: (() => void) | null = null;

  const handler: CoreBlowPluginHttpRouteHandler = async (
    _req: IncomingMessage,
    res: ServerResponse,
  ) => {
    const payload = renderPrometheusMetrics(store);
    res.statusCode = 200;
    res.setHeader("content-type", "text/plain; version=0.0.4; charset=utf-8");
    res.end(payload ? `${payload}\n` : "");
    return true;
  };

  const service: CoreBlowPluginService = {
    id: "diagnostics-prometheus",
    async start() {
      if (unsubscribe) {
        return;
      }
      unsubscribe = onDiagnosticEvent((event) => {
        recordDiagnosticEvent(store, event);
      });
    },
    async stop() {
      unsubscribe?.();
      unsubscribe = null;
      store.reset();
    },
  };

  return { service, handler };
}

export const testApi = {
  createPrometheusMetricStore,
  recordDiagnosticEvent,
  renderPrometheusMetrics,
};
