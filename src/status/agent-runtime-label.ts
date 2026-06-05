import { isCliProvider } from "../agents/model-selection.js";
import type { SessionEntry } from "../config/sessions.js";
import type { CoreBlowConfig } from "../config/config.js";
import { sanitizeTerminalText } from "../terminal/safe-text.js";

const AGENT_RUNTIME_LABELS: Readonly<Record<string, string>> = {
  pi: "CoreBlow Pi Default",
  codex: "OpenAI Codex",
  "codex-cli": "OpenAI Codex",
  "claude-cli": "Claude CLI",
  "google-gemini-cli": "Gemini CLI",
};

function normalizeOptionalString(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function normalizeOptionalLowercaseString(value?: string | null): string | undefined {
  return normalizeOptionalString(value)?.toLowerCase();
}

export function resolveAgentRuntimeLabel(args: {
  config?: CoreBlowConfig;
  sessionEntry?: Pick<
    SessionEntry,
    "acp" | "modelProvider" | "providerOverride"
  >;
  resolvedHarness?: string;
  fallbackProvider?: string;
}): string {
  const acpAgentRaw = normalizeOptionalString(args.sessionEntry?.acp?.agent);
  const acpAgent = acpAgentRaw ? sanitizeTerminalText(acpAgentRaw) : undefined;
  if (acpAgent) {
    const backendRaw = normalizeOptionalString(args.sessionEntry?.acp?.backend);
    const backend = backendRaw ? sanitizeTerminalText(backendRaw) : undefined;
    return backend ? `${acpAgent} (acp/${backend})` : `${acpAgent} (acp)`;
  }

  const runtimeRaw = normalizeOptionalString(args.resolvedHarness);
  const runtime = normalizeOptionalLowercaseString(runtimeRaw);
  if (runtime && runtime !== "auto" && runtime !== "default") {
    return AGENT_RUNTIME_LABELS[runtime] ?? sanitizeTerminalText(runtimeRaw ?? runtime);
  }

  const providerRaw =
    normalizeOptionalString(args.sessionEntry?.modelProvider) ??
    normalizeOptionalString(args.sessionEntry?.providerOverride) ??
    normalizeOptionalString(args.fallbackProvider);
  const provider = providerRaw ? sanitizeTerminalText(providerRaw) : undefined;
  if (provider && isCliProvider(provider, args.config)) {
    return (
      AGENT_RUNTIME_LABELS[normalizeOptionalLowercaseString(providerRaw) ?? ""] ??
      `${provider} (cli)`
    );
  }

  return AGENT_RUNTIME_LABELS.pi;
}
