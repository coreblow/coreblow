import { describe, expect, it } from "vitest";
import type { DiagnosticEventPayload } from "../api.js";
import { createDiagnosticsPrometheusExporter, testApi } from "./service.js";

function baseEvent(): Pick<DiagnosticEventPayload, "seq" | "ts"> {
  return { seq: 1, ts: 1700000000000 };
}

describe("diagnostics-prometheus service", () => {
  it("records model usage metrics without raw session identifiers", () => {
    const store = testApi.createPrometheusMetricStore();

    testApi.recordDiagnosticEvent(store, {
      ...baseEvent(),
      type: "model.usage",
      sessionKey: "agent:main:secret",
      sessionId: "session-secret",
      channel: "discord",
      provider: "openai",
      model: "gpt-5.4",
      usage: { total: 321 },
      durationMs: 1500,
      costUsd: 0.42,
    });

    const rendered = testApi.renderPrometheusMetrics(store);
    expect(rendered).toContain("# TYPE coreblow_model_usage_total counter");
    expect(rendered).toContain(
      'coreblow_model_usage_total{channel="discord",model="gpt-5.4",provider="openai"} 1',
    );
    expect(rendered).toContain(
      'coreblow_model_duration_seconds_sum{channel="discord",model="gpt-5.4",provider="openai"} 1.5',
    );
    expect(rendered).not.toContain("session-secret");
    expect(rendered).not.toContain("agent:main:secret");
  });

  it("redacts and bounds labels for payload and tool loop events", () => {
    const store = testApi.createPrometheusMetricStore();

    testApi.recordDiagnosticEvent(store, {
      ...baseEvent(),
      type: "payload.large",
      surface: "gateway\nbad",
      action: "rejected",
      bytes: 2048,
      reason: "Bearer sk-secret-token-value",
    });
    testApi.recordDiagnosticEvent(store, {
      ...baseEvent(),
      type: "tool.loop",
      toolName: "shell\nbad",
      level: "critical",
      action: "block",
      detector: "ping_pong",
      count: 4,
      message: "contains secret",
    });

    const rendered = testApi.renderPrometheusMetrics(store);
    expect(rendered).toContain(
      'coreblow_payload_large_total{action="rejected",channel="none",plugin_id="none",reason="none",surface="unknown"} 1',
    );
    expect(rendered).toContain(
      'coreblow_tool_loop_total{action="block",detector="ping_pong",level="critical",paired_tool="none",tool="tool"} 1',
    );
    expect(rendered).not.toContain("Bearer");
    expect(rendered).not.toContain("sk-secret");
  });

  it("renders text exposition through the HTTP handler", async () => {
    const exporter = createDiagnosticsPrometheusExporter();
    const chunks: Buffer[] = [];
    let contentType = "";
    const res = {
      statusCode: 0,
      setHeader(name: string, value: string) {
        if (name.toLowerCase() === "content-type") {
          contentType = value;
        }
      },
      end(value?: string) {
        if (value) {
          chunks.push(Buffer.from(value));
        }
      },
    };

    await exporter.service.start({} as never);
    testApi.recordDiagnosticEvent(testApi.createPrometheusMetricStore(), {
      ...baseEvent(),
      type: "message.processed",
      channel: "telegram",
      outcome: "completed",
      durationMs: 25,
    });
    await exporter.handler({} as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(contentType).toBe("text/plain; version=0.0.4; charset=utf-8");
    expect(Buffer.concat(chunks).toString("utf8")).toBe("");
    await exporter.service.stop?.({} as never);
  });
});
