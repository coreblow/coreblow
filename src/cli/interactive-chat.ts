import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import process from "node:process";
import chalk from "chalk";

export interface SlashCommandContext {
  sessionId?: string;
  onResetSession?: () => void;
}

export interface SlashCommandResult {
  handled: boolean;
  shouldExit?: boolean;
  output?: string;
}

export async function handleSlashCommand(
  rawInput: string,
  context?: SlashCommandContext,
): Promise<SlashCommandResult> {
  const trimmed = rawInput.trim();
  if (!trimmed.startsWith("/")) {
    return { handled: false };
  }

  const [cmd, ...args] = trimmed.split(/\s+/);
  const command = cmd.toLowerCase();

  switch (command) {
    case "/exit":
    case "/quit":
      return { handled: true, shouldExit: true, output: "Bye!" };

    case "/help":
      return {
        handled: true,
        output: [
          "Commands:",
          "  /rollback   Undo last file edit checkpoint",
          "  /clear      Start a fresh session",
          "  /sessions   List recent sessions from SQLite store",
          "  /desktop    Launch CoreBlow Studio desktop",
          "  /setup      Provider and model configuration helper",
          "  /help       Show this help message",
          "  /exit       Exit interactive chat",
        ].join("\n"),
      };

    case "/clear":
      context?.onResetSession?.();
      return { handled: true, output: "Session cleared. Started fresh session." };

    case "/rollback": {
      const { getCheckpointManager } = await import("../security/checkpoint-manager.js");
      const targetId = args[0];
      const res = getCheckpointManager().rollbackCheckpoint(targetId, context?.sessionId);
      return { handled: true, output: res.message };
    }

    case "/sessions": {
      const { listSqliteSessions, isSqliteAvailable } = await import(
        "../sessions/sqlite-session-store.js"
      );
      let sessions = isSqliteAvailable() ? listSqliteSessions({ limit: 10 }) : [];
      if (sessions.length === 0) {
        const { listUnifiedSessions } = await import("../sessions/unified-session-store.js");
        sessions = listUnifiedSessions().slice(0, 10);
      }
      if (sessions.length === 0) {
        return { handled: true, output: "No previous sessions found." };
      }
      const lines = ["Recent sessions:"];
      for (const s of sessions) {
        const title = s.title || "(untitled)";
        const count = s.messages?.length ?? 0;
        const time = new Date(s.updatedAt || s.createdAt).toLocaleString();
        lines.push(`  • ${s.id} [${time}] (${count} msgs) - ${title}`);
      }
      return { handled: true, output: lines.join("\n") };
    }

    case "/desktop": {
      const { launchDesktopApp } = await import("./desktop-cli.js");
      const res = launchDesktopApp();
      return {
        handled: true,
        output: res.launched
          ? `CoreBlow Studio launched (${res.strategy}).`
          : "Could not launch desktop app.",
      };
    }

    case "/setup": {
      return {
        handled: true,
        output: "To reconfigure LLM providers and models, run `coreblow setup` or launch CoreBlow TUI (`coreblow`).",
      };
    }

    default:
      return {
        handled: true,
        output: `Unknown slash command: ${command}. Type /help for available commands.`,
      };
  }
}

export async function runOneShotCliQuery(
  prompt: string,
  options: {
    exitProcess?: boolean;
    fetchFn?: typeof fetch;
    gatewayUrl?: string;
  } = {},
): Promise<string> {
  const fetchFn = options.fetchFn ?? fetch;
  const gatewayUrl = options.gatewayUrl ?? "http://127.0.0.1:18789/api/corehub/chat/react";
  const shouldExit = options.exitProcess !== false;

  let reply = "";

  // 1. Try running Gateway
  try {
    const res = await fetchFn(gatewayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        cwd: process.cwd(),
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (res.ok) {
      const data = (await res.json()) as { ok?: boolean; reply?: string; error?: string };
      if (data.reply) {
        reply = data.reply;
      }
    }
  } catch {
    // Gateway offline or unreachable, fall back to local ReAct loop
  }

  // 2. Local fallback if gateway did not reply
  if (!reply) {
    const { runCoreBlowReActLoop } = await import("../agents/coreblow-react-engine.js");
    const result = await runCoreBlowReActLoop({
      prompt,
      defaultCwd: process.cwd(),
      fetchFn,
    });
    reply = result.reply || result.error || "No response received.";
  }

  console.log(reply);
  if (shouldExit) {
    process.exit(0);
  }
  return reply;
}

async function executeInteractiveTurn(prompt: string, sessionId: string): Promise<void> {
  let reply = "";

  // Try Gateway SSE streaming first
  try {
    const res = await fetch("http://127.0.0.1:18789/api/corehub/chat/react", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        prompt,
        sessionId,
        cwd: process.cwd(),
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (res.ok && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === "[DONE]") break;
          try {
            const data = JSON.parse(dataStr);
            if (data.step) {
              process.stdout.write(chalk.dim(`› ${data.step}\n`));
            } else if (data.reply) {
              reply = data.reply;
            }
          } catch {}
        }
      }
    }
  } catch {
    // Gateway not running or unreachable
  }

  if (reply) {
    console.log(reply);
    return;
  }

  // Fallback to local ReAct loop
  const { runCoreBlowReActLoop } = await import("../agents/coreblow-react-engine.js");
  const result = await runCoreBlowReActLoop({
    prompt,
    sessionId,
    defaultCwd: process.cwd(),
    onProgressStep: (step) => {
      process.stdout.write(chalk.dim(`› ${step}\n`));
    },
  });

  if (result.reply) {
    console.log(result.reply);
  } else if (result.error) {
    console.error(chalk.hex("#F97066")(`Error: ${result.error}`));
  }
}

export async function runInteractiveCliChat(): Promise<void> {
  let sessionId = `cli_${Date.now().toString(36)}`;

  console.log(chalk.bold.hex("#F6C453")("CoreBlow v2.1.1") + chalk.dim(" · Single-Brain :18789"));
  console.log(
    chalk.dim("Type ") +
      chalk.hex("#F6C453")("/help") +
      chalk.dim(" for slash commands, or ") +
      chalk.hex("#F6C453")("/exit") +
      chalk.dim(" to quit.\n"),
  );

  const rl = readline.createInterface({ input, output });

  try {
    while (true) {
      let line: string;
      try {
        const prompt = chalk.bold.hex("#F6C453")("coreblow") + chalk.hex("#F2A65A")(" ❯ ");
        line = await rl.question(prompt);
      } catch {
        // EOF or Ctrl+D
        break;
      }

      const trimmed = line.trim();
      if (!trimmed) continue;

      const slashRes = await handleSlashCommand(trimmed, {
        sessionId,
        onResetSession: () => {
          sessionId = `cli_${Date.now().toString(36)}`;
        },
      });

      if (slashRes.handled) {
        if (slashRes.output) {
          console.log(slashRes.output);
        }
        if (slashRes.shouldExit) {
          break;
        }
        continue;
      }

      await executeInteractiveTurn(trimmed, sessionId);
    }
  } finally {
    rl.close();
  }
}
