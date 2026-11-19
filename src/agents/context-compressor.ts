/**
 * CoreBlow Autonomous Engine: Context Compressor & Prompt Cache Boundary
 *
 * Implements token budget estimation, automatic context compression, prompt
 * cache boundary tagging, and transparent context-overflow turn recovery.
 */

export interface ContextMessage {
  role: string;
  content?: string | Array<{ type: string; text?: string; [key: string]: unknown }> | null;
  tool_calls?: Array<{
    id?: string;
    type?: string;
    function?: { name?: string; arguments?: string };
  }>;
  tool_call_id?: string;
  [key: string]: unknown;
}

export interface CompressionOptions {
  maxContextTokens?: number;
  forceAggressive?: boolean;
  preserveRecentCount?: number;
}

export interface CompressionResult {
  messages: ContextMessage[];
  compressed: boolean;
  savedTokens: number;
  removedMessages: number;
}

/**
 * Deterministic token estimator for messages.
 * Uses standard character heuristics (chars / 3.8) plus per-message envelope overhead.
 */
export function estimateMessageTokens(message: ContextMessage): number {
  let charCount = (message.role?.length ?? 0) + 4;
  if (typeof message.content === "string") {
    charCount += message.content.length;
  } else if (Array.isArray(message.content)) {
    charCount += JSON.stringify(message.content).length;
  }
  if (message.tool_calls) {
    charCount += JSON.stringify(message.tool_calls).length;
  }
  if (message.tool_call_id) {
    charCount += message.tool_call_id.length + 8;
  }
  return Math.ceil(charCount / 3.8);
}

/**
 * Estimates total tokens across the entire conversation history.
 */
export function estimateTotalTokens(messages: ContextMessage[]): number {
  return messages.reduce((acc, msg) => acc + estimateMessageTokens(msg), 0);
}

/**
 * Checks if an HTTP error response indicates a context length or token overflow.
 */
export function isContextLengthExceededError(status: number, errText: string): boolean {
  if (status !== 400 && status !== 413) {
    return false;
  }
  const lower = (errText || "").toLowerCase();
  return (
    lower.includes("context_length_exceeded") ||
    lower.includes("maximum context length") ||
    lower.includes("prompt is too long") ||
    lower.includes("too many tokens") ||
    lower.includes("token limit") ||
    lower.includes("exceeds token limit") ||
    lower.includes("context window") ||
    lower.includes("max_tokens")
  );
}

/**
 * Automatically compresses conversation turns if total tokens exceed 78% of
 * maxContextTokens, or aggressively when forceAggressive is enabled.
 *
 * Rules:
 * - Always preserves the system prompt (pinned CONSTRAINTS + USER.md + dialectic profile).
 * - Always preserves the most recent turns (default 8 messages) verbatim.
 * - Compresses middle turns by truncating verbose tool outputs > 600 chars into
 *   structured summaries, or collapsing older turn chains into concise checkpoints.
 */
export function compressConversationIfNeeded(
  messages: ContextMessage[],
  options?: CompressionOptions,
): CompressionResult {
  const maxTokens = options?.maxContextTokens ?? 100_000;
  const threshold = Math.floor(maxTokens * 0.78);
  const initialTokens = estimateTotalTokens(messages);
  const forceAggressive = Boolean(options?.forceAggressive);

  if (!forceAggressive && initialTokens <= threshold) {
    return {
      messages,
      compressed: false,
      savedTokens: 0,
      removedMessages: 0,
    };
  }

  if (messages.length <= 2) {
    return {
      messages,
      compressed: false,
      savedTokens: 0,
      removedMessages: 0,
    };
  }

  // Identify system message vs working turns
  let systemMsg: ContextMessage | undefined;
  let workingTurns: ContextMessage[] = [];

  if (messages[0]?.role === "system") {
    systemMsg = messages[0];
    workingTurns = messages.slice(1);
  } else {
    workingTurns = [...messages];
  }

  const preserveRecent = options?.preserveRecentCount ?? 8;

  // If working turns are few, truncate any excessively large tool outputs inside them
  if (workingTurns.length <= preserveRecent) {
    let truncatedCount = 0;
    const cleanedTurns = workingTurns.map((msg, idx) => {
      // Never truncate the very last user message
      if (idx === workingTurns.length - 1 && msg.role === "user") {
        return msg;
      }
      if (msg.role === "tool" && typeof msg.content === "string" && msg.content.length > 600) {
        truncatedCount++;
        const head = msg.content.slice(0, 300);
        const tail = msg.content.slice(-150);
        return {
          ...msg,
          content: `[Compressed Tool Output: tool_call_id=${msg.tool_call_id ?? "unknown"}, original length=${msg.content.length} chars]\n${head}\n... <truncated middle output> ...\n${tail}`,
        };
      }
      return msg;
    });

    const newMessages = systemMsg ? [systemMsg, ...cleanedTurns] : cleanedTurns;
    const finalTokens = estimateTotalTokens(newMessages);

    return {
      messages: newMessages,
      compressed: truncatedCount > 0,
      savedTokens: Math.max(0, initialTokens - finalTokens),
      removedMessages: 0,
    };
  }

  // Split into older middle turns and preserved recent turns
  const middleTurns = workingTurns.slice(0, -preserveRecent);
  const recentTurns = workingTurns.slice(-preserveRecent);

  // Phase A: Truncate large tool outputs in middle turns
  const processedMiddle: ContextMessage[] = [];
  const toolsUsed = new Set<string>();
  const filesTouched = new Set<string>();

  for (const msg of middleTurns) {
    if (msg.role === "tool") {
      let content = typeof msg.content === "string" ? msg.content : "";
      if (content.length > 600) {
        const head = content.slice(0, 250);
        const tail = content.slice(-100);
        content = `[Compressed Tool Output: tool_call_id=${msg.tool_call_id ?? "unknown"}, length=${content.length} chars]\n${head}\n... <output truncated> ...\n${tail}`;
      }
      processedMiddle.push({
        ...msg,
        content,
      });
    } else if (msg.role === "assistant" && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        if (tc.function?.name) {
          toolsUsed.add(tc.function.name);
        }
        if (tc.function?.arguments) {
          try {
            const args = JSON.parse(tc.function.arguments);
            if (args.path) filesTouched.add(String(args.path));
            if (args.file) filesTouched.add(String(args.file));
          } catch {
            // Ignore parse errors
          }
        }
      }
      processedMiddle.push(msg);
    } else {
      processedMiddle.push(msg);
    }
  }

  let assembledMessages = systemMsg
    ? [systemMsg, ...processedMiddle, ...recentTurns]
    : [...processedMiddle, ...recentTurns];

  let currentEstTokens = estimateTotalTokens(assembledMessages);

  // Phase B: If still over budget or forceAggressive, collapse entire middle turns
  if (forceAggressive || currentEstTokens > threshold) {
    const filesList = Array.from(filesTouched).slice(0, 10);
    const summaryText = `[Compressed Turn Summary: ${middleTurns.length} older turn message(s) omitted to preserve token window. Tools executed: ${Array.from(toolsUsed).join(", ") || "standard operations"}. Files touched: ${filesList.join(", ") || "none"}. Outcomes successfully applied.]`;

    const summaryMessage: ContextMessage = {
      role: "assistant",
      content: summaryText,
    };

    assembledMessages = systemMsg
      ? [systemMsg, summaryMessage, ...recentTurns]
      : [summaryMessage, ...recentTurns];
  }

  const finalTokens = estimateTotalTokens(assembledMessages);

  return {
    messages: assembledMessages,
    compressed: true,
    savedTokens: Math.max(0, initialTokens - finalTokens),
    removedMessages: Math.max(0, messages.length - assembledMessages.length),
  };
}

/**
 * Applies cache-friendly prompt cache control markers to Anthropic or compatible
 * completions endpoints.
 */
export function applyPromptCacheControl(
  messages: ContextMessage[],
  isAnthropic = false,
): ContextMessage[] {
  if (!isAnthropic || messages.length === 0) {
    return messages;
  }

  const first = messages[0];
  if (first.role === "system") {
    if (typeof first.content === "string") {
      first.content = [
        {
          type: "text",
          text: first.content,
          cache_control: { type: "ephemeral" },
        },
      ];
    } else if (Array.isArray(first.content) && first.content.length > 0) {
      const lastBlock = first.content[first.content.length - 1];
      if (typeof lastBlock === "object" && lastBlock !== null) {
        (lastBlock as Record<string, unknown>).cache_control = { type: "ephemeral" };
      }
    }
  }

  return messages;
}
