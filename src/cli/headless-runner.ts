import process from "node:process";
import { getFlagValue, hasFlag } from "./argv.js";
import { loadConfig } from "../config/config.js";
import { resolveAgentModelPrimaryValue } from "../config/model-input.js";
import { runCoreBlowReActLoop } from "../agents/coreblow-react-engine.js";
import { estimateCostUsd } from "../tui/ink/context-telemetry.js";
import { splitModelRef } from "../tui/ink/model-picker-utils.js";
import {
  executeCommandOnBackend,
  type ExecutionBackendConfig,
  type ExecutionBackendType,
} from "../execution/execution-backend.js";

const MAX_STDIN_BYTES = 10 * 1024 * 1024; // 10 MB

export interface HeadlessRunOptions {
  prompt?: string;
  outputFormat?: "text" | "json" | "stream-json";
  model?: string;
  permissionMode?: string;
  maxTurns?: number;
  bare?: boolean;
  backend?: ExecutionBackendType | string;
  backendTarget?: string;
  exitProcess?: boolean;
  stdinStream?: NodeJS.ReadableStream;
  fetchFn?: typeof fetch;
}

export interface HeadlessRunResult {
  ok: boolean;
  exitCode: number;
  sessionId: string;
  model: string;
  result: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  costUsd: number;
  durationMs: number;
  error?: string;
}

/**
 * Reads data from a readable stream up to maxBytes.
 * Throws if data exceeds maxBytes.
 */
export async function readStreamWithLimit(
  stream: NodeJS.ReadableStream = process.stdin,
  maxBytes = MAX_STDIN_BYTES,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let totalBytes = 0;
    const chunks: Buffer[] = [];

    stream.on("data", (chunk: Buffer | string) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buf.length;
      if (totalBytes > maxBytes) {
        stream.removeAllListeners("data");
        reject(new Error(`Input exceeds maximum size of ${Math.round(maxBytes / (1024 * 1024))} MB`));
        return;
      }
      chunks.push(buf);
    });

    stream.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    stream.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Parses headless CLI flags from argv.
 */
export function parseHeadlessArgs(argv: string[]): HeadlessRunOptions {
  const printPrompt =
    getFlagValue(argv, "-p") ??
    getFlagValue(argv, "--print") ??
    getFlagValue(argv, "-q") ??
    getFlagValue(argv, "--query");

  const formatRaw = (getFlagValue(argv, "--output-format") || "text").toLowerCase();
  const outputFormat =
    formatRaw === "json" || formatRaw === "stream-json" ? formatRaw : "text";

  const model = getFlagValue(argv, "--model") || undefined;
  const permissionMode = getFlagValue(argv, "--permission-mode") || undefined;
  const backend = getFlagValue(argv, "--backend") || undefined;
  const backendTarget = getFlagValue(argv, "--backend-target") || undefined;
  const maxTurnsRaw = getFlagValue(argv, "--max-turns");
  const maxTurns = maxTurnsRaw ? parseInt(maxTurnsRaw, 10) : undefined;
  const bare = hasFlag(argv, "--bare");

  let prompt = typeof printPrompt === "string" ? printPrompt : undefined;

  // Handle 'ask' primary command (e.g. coreblow ask "prompt")
  const askIndex = argv.indexOf("ask");
  if (askIndex !== -1 && !prompt) {
    const askPrompt = argv.slice(askIndex + 1).filter((a) => !a.startsWith("-")).join(" ").trim();
    if (askPrompt) {
      prompt = askPrompt;
    }
  }

  return {
    prompt,
    outputFormat,
    model,
    permissionMode,
    backend,
    backendTarget,
    maxTurns,
    bare,
  };
}

/**
 * Core headless execution routine.
 */
export async function runHeadlessExecution(
  options: HeadlessRunOptions,
): Promise<HeadlessRunResult> {
  const startTime = Date.now();
  let fullPrompt = options.prompt || "";

  // 1. Read stdin if piped and stream is provided or stdin is not TTY
  const isPiped = options.stdinStream ? true : !process.stdin.isTTY;
  if (isPiped) {
    try {
      const stdinData = await readStreamWithLimit(
        options.stdinStream || process.stdin,
        MAX_STDIN_BYTES,
      );
      if (stdinData.trim()) {
        fullPrompt = fullPrompt ? `${stdinData.trim()}\n\n${fullPrompt}` : stdinData.trim();
      }
    } catch (err) {
      process.stderr.write(`[coreblow] Error: ${err instanceof Error ? err.message : String(err)}\n`);
      return {
        ok: false,
        exitCode: 2,
        sessionId: "",
        model: options.model || "coreblow/native",
        result: "",
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        costUsd: 0,
        durationMs: Date.now() - startTime,
        error: String(err),
      };
    }
  }

  if (!fullPrompt.trim()) {
    process.stderr.write("[coreblow] Error: Missing prompt or piped stdin input.\n");
    return {
      ok: false,
      exitCode: 2,
      sessionId: "",
      model: options.model || "coreblow/native",
      result: "",
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      costUsd: 0,
      durationMs: Date.now() - startTime,
      error: "Missing prompt or stdin input",
    };
  }

  const cfg = loadConfig();
  const selectedModel =
    options.model || resolveAgentModelPrimaryValue(cfg.agents?.defaults?.model) || "coreblow/native";
  const sessionId = `cli_headless_${Date.now().toString(36)}`;

  // Emit init event for stream-json
  if (options.outputFormat === "stream-json") {
    process.stdout.write(
      JSON.stringify({
        type: "init",
        sessionId,
        model: selectedModel,
      }) + "\n",
    );
  }

  // 2. Execute via ReAct loop
  let resultText = "";
  let errorMsg: string | undefined;

  const processRunner = options.backend
    ? async (
        command: string,
        args: string[],
        runOpts: { cwd?: string; env?: Record<string, string>; timeout?: number },
      ) => {
        const fullCmd = [command, ...args].join(" ");
        const res = await executeCommandOnBackend(
          fullCmd,
          {
            type: options.backend as any,
            target: options.backendTarget,
            timeoutMs: runOpts.timeout,
          },
          {
            cwd: runOpts.cwd,
            env: runOpts.env,
          },
        );
        return { stdout: res.stdout, stderr: res.stderr, exitCode: res.exitCode };
      }
    : undefined;

  try {
    const reactRes = await runCoreBlowReActLoop({
      prompt: fullPrompt,
      sessionId,
      model: selectedModel,
      defaultCwd: process.cwd(),
      maxTurns: options.maxTurns ?? (options.bare ? 5 : 20),
      processRunner,
      onProgressStep: (step) => {
        if (options.outputFormat === "stream-json") {
          process.stdout.write(
            JSON.stringify({
              type: "delta",
              text: `› ${step}\n`,
            }) + "\n",
          );
        } else if (options.outputFormat === "text") {
          process.stderr.write(`› ${step}\n`);
        }
      },
      fetchFn: options.fetchFn,
    });

    resultText = reactRes.reply || "";
    if (!reactRes.ok && reactRes.error) {
      errorMsg = reactRes.error;
    }

    // Stream tool steps in stream-json
    if (options.outputFormat === "stream-json" && Array.isArray(reactRes.steps)) {
      for (const step of reactRes.steps) {
        process.stdout.write(
          JSON.stringify({
            type: "tool_use",
            tool: step.tool,
            input: step.input,
          }) + "\n",
        );
        process.stdout.write(
          JSON.stringify({
            type: "tool_result",
            tool: step.tool,
            output: step.output,
            exitCode: step.exitCode,
          }) + "\n",
        );
      }
    }
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  const durationMs = Date.now() - startTime;
  const inputTokens = Math.ceil(fullPrompt.length / 3.8);
  const outputTokens = Math.ceil((resultText.length || 0) / 3.8);
  const totalTokens = inputTokens + outputTokens;
  const { provider } = splitModelRef(selectedModel);
  const costUsd = estimateCostUsd(inputTokens, outputTokens, provider);

  const finalOk = !errorMsg && Boolean(resultText);
  const exitCode = finalOk ? 0 : 1;

  const resultPayload: HeadlessRunResult = {
    ok: finalOk,
    exitCode,
    sessionId,
    model: selectedModel,
    result: resultText,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens,
    },
    costUsd,
    durationMs,
    error: errorMsg,
  };

  // 3. Format output strictly to stdout
  if (options.outputFormat === "json") {
    process.stdout.write(JSON.stringify(resultPayload, null, 2) + "\n");
  } else if (options.outputFormat === "stream-json") {
    if (finalOk) {
      process.stdout.write(
        JSON.stringify({
          type: "result",
          text: resultText,
          usage: resultPayload.usage,
          costUsd,
          durationMs,
        }) + "\n",
      );
    } else {
      process.stdout.write(
        JSON.stringify({
          type: "error",
          error: errorMsg || "Execution failed",
        }) + "\n",
      );
    }
  } else {
    // Plain text mode
    if (resultText) {
      process.stdout.write(resultText + "\n");
    }
    if (errorMsg) {
      process.stderr.write(`[coreblow] Error: ${errorMsg}\n`);
    }
  }

  return resultPayload;
}

/**
 * Handles headless CLI invocation and exits cleanly with standardized exit codes.
 */
export async function runHeadlessCli(argv: string[] = process.argv): Promise<void> {
  const options = parseHeadlessArgs(argv);

  const sigintHandler = () => {
    process.stderr.write("\n[coreblow] Operation cancelled.\n");
    process.exit(130);
  };
  process.on("SIGINT", sigintHandler);
  process.on("SIGTERM", sigintHandler);

  try {
    const res = await runHeadlessExecution(options);
    process.removeListener("SIGINT", sigintHandler);
    process.removeListener("SIGTERM", sigintHandler);
    process.exit(res.exitCode);
  } catch (err) {
    process.stderr.write(`[coreblow] Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
