import { describe, expect, it } from "vitest";
import {
  EXPECTED_CODEX_MODELS_COMMAND_TEXT,
  EXPECTED_CODEX_STATUS_COMMAND_TEXT,
  isExpectedCodexModelsCommandText,
  isExpectedCodexStatusCommandText,
} from "./gateway-codex-harness.live-helpers.js";

describe("gateway codex harness live helpers", () => {
  it("accepts current codex status prose from the live harness", () => {
    const text =
      "CoreBlow is running on `openai/gpt-5.5` with low reasoning/text settings. Context is at `22k/272k` tokens, no compactions, and the current session is `agent:dev:live-codex-harness`.";

    expect(
      EXPECTED_CODEX_STATUS_COMMAND_TEXT.some((expectedText) => text.includes(expectedText)),
    ).toBe(false);
    expect(isExpectedCodexStatusCommandText(text)).toBe(true);
  });

  it("accepts current status prose that reports healthy session context without the session id", () => {
    const text = [
      "Status: running on `openai/gpt-5.5` with low reasoning/text settings.",
      "",
      "Session context is healthy: `22k/272k` tokens used, `0` compactions, `53%` cache hit. Current workspace is `/tmp/coreblow-live-codex-harness/workspace/dev`.",
    ].join("\n");

    expect(isExpectedCodexStatusCommandText(text)).toBe(true);
  });

  it("accepts terse ready and idle statuses", () => {
    expect(isExpectedCodexStatusCommandText("Idle and ready.")).toBe(true);
    expect(isExpectedCodexStatusCommandText("Ready.")).toBe(true);
    expect(EXPECTED_CODEX_STATUS_COMMAND_TEXT.some((text) => "Ready.".includes(text))).toBe(true);
  });

  it("accepts the current status card emitted by OpenAI Codex", () => {
    const text = [
      "Current session status:",
      "",
      "- Model: `openai/gpt-5.5`",
      "- Context: `22k/272k` tokens, `8%`",
      "- Cache hit: `52%`",
      "- Compactions: `0`",
      "- Execution: `direct`",
      "- Runtime: `OpenAI Codex`",
      "- Think: `low`",
      "- Active tasks: `1`",
    ].join("\n");

    expect(isExpectedCodexStatusCommandText(text)).toBe(true);
  });

  it("rejects status prose for a different codex session", () => {
    const text =
      "CoreBlow is running on `openai/gpt-5.5` with low reasoning/text settings. Context is at `22k/272k` tokens, no compactions, and the current session is `agent:dev:other`.";

    expect(isExpectedCodexStatusCommandText(text)).toBe(false);
  });

  it("accepts the interactive model-selection summary emitted by current codex", () => {
    const text = [
      "`/codex models` opened an interactive model-selection prompt rather than printing a plain list.",
      "",
      "Visible options in this session:",
      "- `GPT-5.4`",
      "- `GPT-5.3-Codex` (listed as the existing model)",
      "",
      "Current active model is `codex/gpt-5.4`.",
    ].join("\n");

    expect(
      EXPECTED_CODEX_MODELS_COMMAND_TEXT.some((expectedText) => text.includes(expectedText)),
    ).toBe(true);
    expect(isExpectedCodexModelsCommandText(text)).toBe(true);
  });

  it("accepts configured-model fallback summaries", () => {
    const texts = [
      [
        "Configured models in this session:",
        "- `codex/gpt-5.4`",
        "Current session model is `codex/gpt-5.4`.",
      ].join("\n"),
      [
        "I can only confirm the current session model here: `codex/gpt-5.4`.",
        "",
        "A direct `codex models` CLI lookup is not available in this environment because `codex` is not installed on the shell path.",
      ].join("\n"),
      [
        "I couldn’t get `/codex models` from the shell here.",
        "",
        "What happened:",
        "- In the sandbox, `codex models` failed because the kernel disallows unprivileged user namespaces.",
        "",
        "Current session model from CoreBlow status is `openai/gpt-5.5`.",
      ].join("\n"),
    ];

    for (const text of texts) {
      expect(isExpectedCodexModelsCommandText(text)).toBe(true);
    }
  });

  it("rejects unrelated codex command output", () => {
    expect(isExpectedCodexModelsCommandText("Codex is healthy.")).toBe(false);
  });
});
