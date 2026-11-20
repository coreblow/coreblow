import { inkPalette } from "./theme.js";
import {
  compressConversationIfNeeded,
  estimateTotalTokens,
  type ContextMessage,
} from "../../agents/context-compressor.js";
import { PROVIDER_TOKEN_PRICING } from "../../providers/credential-pool.js";

export interface ContextMetrics {
  usedTokens: number;
  maxTokens: number;
  percentage: number;
  color: string;
  bar: string;
  formattedUsed: string;
  formattedMax: string;
  costUsd: number;
}

export interface ContextBreakdown {
  systemPromptTokens: number;
  rulesAndMemoryTokens: number;
  skillsTokens: number;
  conversationTokens: number;
  toolOutputsTokens: number;
  totalTokens: number;
  maxTokens: number;
  percentage: number;
  bar: string;
  color: string;
}

/**
 * Returns color hex according to percentage thresholds:
 * <50%: green, 50-80%: yellow/gold, 80-95%: orange, >=95%: red
 */
export function getContextColor(percentage: number): string {
  if (percentage < 50) return inkPalette.success;
  if (percentage < 80) return inkPalette.accent;
  if (percentage < 95) return inkPalette.accentSoft;
  return inkPalette.error;
}

/**
 * Builds a visual 10-block progress bar [████░░░░░░].
 */
export function buildProgressBar(percentage: number, length = 10): string {
  const clamped = Math.max(0, Math.min(100, percentage));
  const filled = Math.min(length, Math.round((clamped / 100) * length));
  const empty = length - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
}

/**
 * Formats token count (e.g. 12400 -> "12.4K", 200000 -> "200K").
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    const k = tokens / 1_000;
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
  }
  return String(tokens);
}

/**
 * Calculates estimated USD cost from token counts and provider.
 */
export function estimateCostUsd(
  inputTokens: number,
  outputTokens: number,
  provider = "anthropic",
): number {
  const prov = provider.toLowerCase();
  const pricing = PROVIDER_TOKEN_PRICING[prov] || {
    inputPerMillionUsd: 2.5,
    outputPerMillionUsd: 10.0,
  };
  const cost =
    (inputTokens / 1_000_000) * pricing.inputPerMillionUsd +
    (outputTokens / 1_000_000) * pricing.outputPerMillionUsd;
  return Math.round(cost * 10000) / 10000;
}

/**
 * Computes context metrics for the active session.
 */
export function calculateContextMetrics(params: {
  usedTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  maxTokens?: number;
  provider?: string;
}): ContextMetrics {
  const maxTokens = params.maxTokens && params.maxTokens > 0 ? params.maxTokens : 200_000;
  const input = params.inputTokens ?? Math.round((params.usedTokens ?? 0) * 0.75);
  const output = params.outputTokens ?? Math.round((params.usedTokens ?? 0) * 0.25);
  const usedTokens = params.usedTokens ?? input + output;

  const percentage = Math.round((usedTokens / maxTokens) * 100);
  const color = getContextColor(percentage);
  const bar = buildProgressBar(percentage, 8);
  const costUsd = estimateCostUsd(input, output, params.provider);

  return {
    usedTokens,
    maxTokens,
    percentage,
    color,
    bar,
    formattedUsed: formatTokenCount(usedTokens),
    formattedMax: formatTokenCount(maxTokens),
    costUsd,
  };
}

/**
 * Computes structured context breakdown for /context command.
 */
export function getContextBreakdown(
  messages: Array<{ role: string; text?: string; content?: any }>,
  maxTokens = 200_000,
): ContextBreakdown {
  let systemTokens = 0;
  let memoryTokens = 0;
  let skillsTokens = 0;
  let conversationTokens = 0;
  let toolTokens = 0;

  for (const m of messages) {
    const raw = typeof m.text === "string" ? m.text : JSON.stringify(m.content || "");
    const tokens = Math.ceil(raw.length / 3.8);

    if (m.role === "system") {
      if (raw.includes("AGENTS.md") || raw.includes("SOUL.md") || raw.includes("Memory:")) {
        memoryTokens += tokens;
      } else if (raw.includes("Skills:") || raw.includes("tool")) {
        skillsTokens += tokens;
      } else {
        systemTokens += tokens;
      }
    } else if (m.role === "tool") {
      toolTokens += tokens;
    } else {
      conversationTokens += tokens;
    }
  }

  const totalTokens = systemTokens + memoryTokens + skillsTokens + conversationTokens + toolTokens;
  const percentage = Math.round((totalTokens / maxTokens) * 100);

  return {
    systemPromptTokens: systemTokens,
    rulesAndMemoryTokens: memoryTokens,
    skillsTokens,
    conversationTokens,
    toolOutputsTokens: toolTokens,
    totalTokens,
    maxTokens,
    percentage,
    bar: buildProgressBar(percentage, 10),
    color: getContextColor(percentage),
  };
}

export type MessageRole = "user" | "assistant" | "system" | "tool" | "error";

/**
 * Compaction handler for /compact [focus].
 * Preserves project rules, active memory, and recently modified files.
 */
export function compactHistory<T extends { id: string; role: MessageRole; text: string }>(
  messages: T[],
  options?: { focus?: string; maxTokens?: number },
): { messages: Array<{ id: string; role: MessageRole; text: string }>; savedTokens: number; compressed: boolean } {
  const contextMessages: ContextMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.text,
  }));

  const result = compressConversationIfNeeded(contextMessages, {
    maxContextTokens: options?.maxTokens ?? 100_000,
    forceAggressive: true,
  });

  if (!result.compressed) {
    return {
      messages,
      savedTokens: 0,
      compressed: false,
    };
  }

  const compacted = result.messages.map((m, idx) => ({
    id: `compacted_${idx}_${Date.now()}`,
    role: (m.role === "assistant" || m.role === "system" || m.role === "tool" || m.role === "error" ? m.role : "user") as MessageRole,
    text: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
  }));

  return {
    messages: compacted,
    savedTokens: result.savedTokens,
    compressed: true,
  };
}
