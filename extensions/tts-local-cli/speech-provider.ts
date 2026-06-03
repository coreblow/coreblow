import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runFfmpeg } from "coreblow/plugin-sdk/media-runtime";
import { createSubsystemLogger } from "coreblow/plugin-sdk/runtime-env";
import { tempWorkspace } from "coreblow/plugin-sdk/temp-path";
import type {
  SpeechProviderConfig,
  SpeechProviderPlugin,
  SpeechSynthesisRequest,
  SpeechTelephonySynthesisRequest,
} from "coreblow/plugin-sdk/speech-core";

const log = createSubsystemLogger("tts-local-cli");

const VALID_OUTPUT_FORMATS = ["mp3", "opus", "wav"] as const;
const AUDIO_EXTENSIONS = new Set([".wav", ".mp3", ".opus", ".ogg", ".m4a"]);
const DEFAULT_TIMEOUT_MS = 120_000;

type OutputFormat = (typeof VALID_OUTPUT_FORMATS)[number];

type CliConfig = {
  command: string;
  args?: string[];
  outputFormat?: OutputFormat;
  timeoutMs?: number;
  cwd?: string;
  env?: Record<string, string>;
};

function asObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value
    : undefined;
}

function asRecord(value: unknown): Record<string, string> | undefined {
  const obj = asObject(value);
  if (!obj) {
    return undefined;
  }
  const result: Record<string, string> = {};
  for (const [key, candidate] of Object.entries(obj)) {
    if (typeof candidate === "string") {
      result[key] = candidate;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function normalizeOutputFormat(value: unknown): OutputFormat {
  if (typeof value !== "string") {
    return "mp3";
  }
  const normalized = value.toLowerCase().trim();
  return VALID_OUTPUT_FORMATS.includes(normalized as OutputFormat)
    ? (normalized as OutputFormat)
    : "mp3";
}

function resolveCliProviderConfig(rawConfig: Record<string, unknown>): SpeechProviderConfig {
  const providers = asObject(rawConfig.providers);
  return asObject(providers?.["tts-local-cli"]) ?? asObject(providers?.cli) ?? {};
}

function getConfig(cfg: SpeechProviderConfig): CliConfig | null {
  const command = typeof cfg.command === "string" ? cfg.command.trim() : "";
  if (!command) {
    return null;
  }
  return {
    command,
    args: asStringArray(cfg.args),
    outputFormat: normalizeOutputFormat(cfg.outputFormat),
    timeoutMs: typeof cfg.timeoutMs === "number" ? cfg.timeoutMs : DEFAULT_TIMEOUT_MS,
    cwd: typeof cfg.cwd === "string" ? cfg.cwd : undefined,
    env: asRecord(cfg.env),
  };
}

function stripEmojis(text: string): string {
  return text
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function applyTemplate(template: string, ctx: Record<string, string | undefined>): string {
  return template.replace(/{{\s*(\w+)\s*}}/gi, (_, key) => {
    const normalizedKey = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
    return ctx[normalizedKey] ?? ctx[key] ?? "";
  });
}

function parseCommand(command: string): { cmd: string; initialArgs: string[] } {
  const parts: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";

  for (const char of command.trim()) {
    if (inQuote) {
      if (char === quoteChar) {
        inQuote = false;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      inQuote = true;
      quoteChar = char;
      continue;
    }
    if (char === " " || char === "\t") {
      if (current) {
        parts.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }

  if (current) {
    parts.push(current);
  }

  return { cmd: parts[0] || "", initialArgs: parts.slice(1) };
}

function findAudioFile(dir: string, baseName: string): string | null {
  const files = readdirSync(dir);
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (AUDIO_EXTENSIONS.has(ext) && (file.startsWith(baseName) || file.includes(baseName))) {
      return path.join(dir, file);
    }
  }
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (AUDIO_EXTENSIONS.has(ext)) {
      return path.join(dir, file);
    }
  }
  return null;
}

function detectFormat(filePath: string): OutputFormat | null {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".opus" || ext === ".ogg") {
    return "opus";
  }
  if (ext === ".wav") {
    return "wav";
  }
  if (ext === ".mp3" || ext === ".m4a") {
    return "mp3";
  }
  return null;
}

function getFileExt(format: string): string {
  if (format === "opus") {
    return ".opus";
  }
  if (format === "wav") {
    return ".wav";
  }
  return ".mp3";
}

async function runCli(params: {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs: number;
  text: string;
  outputDir: string;
  filePrefix: string;
  outputFormat?: OutputFormat;
}): Promise<{ buffer: Buffer; actualFormat: OutputFormat; audioPath?: string }> {
  const cleanText = stripEmojis(params.text);
  if (!cleanText) {
    throw new Error("CLI TTS: text is empty after removing emojis");
  }

  const outputExt = getFileExt(params.outputFormat ?? "wav");
  const ctx: Record<string, string | undefined> = {
    Text: cleanText,
    OutputPath: path.join(params.outputDir, `${params.filePrefix}${outputExt}`),
    OutputDir: params.outputDir,
    OutputBase: params.filePrefix,
  };

  const { cmd, initialArgs } = parseCommand(params.command);
  if (!cmd) {
    throw new Error("CLI TTS: invalid command");
  }

  const baseArgs = [...initialArgs, ...params.args];
  const args = baseArgs.map((arg) => applyTemplate(arg, ctx));

  return await new Promise((resolve, reject) => {
    let timedOut = false;
    let proc: ReturnType<typeof spawn> | null = null;

    const timer = setTimeout(() => {
      timedOut = true;
      proc?.kill();
      setTimeout(() => proc?.kill("SIGKILL"), 5_000).unref();
    }, params.timeoutMs);

    const env = params.env ? { ...process.env, ...params.env } : process.env;
    proc = spawn(cmd, args, { cwd: params.cwd, env, stdio: ["pipe", "pipe", "pipe"] });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    proc.stdout?.on("data", (chunk) => stdoutChunks.push(chunk));
    proc.stderr?.on("data", (chunk) => stderrChunks.push(chunk));

    proc.on("error", (error) => {
      clearTimeout(timer);
      reject(new Error(`CLI TTS failed: ${error.message}`));
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`CLI TTS timed out after ${params.timeoutMs}ms`));
        return;
      }
      if (code !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString("utf8");
        reject(new Error(`CLI TTS exit ${code}: ${stderr}`));
        return;
      }

      const audioFile = findAudioFile(params.outputDir, params.filePrefix);
      if (audioFile) {
        if (!existsSync(audioFile)) {
          reject(new Error(`CLI TTS: output file not found at ${audioFile}`));
          return;
        }
        const format = detectFormat(audioFile);
        if (!format) {
          reject(new Error(`CLI TTS: unknown format for ${audioFile}`));
          return;
        }
        resolve({
          buffer: readFileSync(audioFile),
          actualFormat: format,
          audioPath: audioFile,
        });
        return;
      }

      const stdout = Buffer.concat(stdoutChunks);
      if (stdout.length > 0) {
        resolve({ buffer: stdout, actualFormat: "wav" });
        return;
      }

      reject(new Error("CLI TTS produced no output"));
    });

    proc.stdin?.on("error", () => {});
    if (!baseArgs.some((arg) => /{{\s*text\s*}}/i.test(arg))) {
      proc.stdin?.write(cleanText);
    }
    proc.stdin?.end();
  });
}

async function convertAudio(
  inputPath: string,
  outputDir: string,
  target: OutputFormat,
): Promise<Buffer> {
  const outputFileName = `converted${getFileExt(target)}`;
  const outputPath = path.join(outputDir, outputFileName);
  const args = ["-y", "-i", inputPath];

  if (target === "opus") {
    args.push("-c:a", "libopus", "-b:a", "64k", "-f", "opus");
  } else if (target === "wav") {
    args.push("-c:a", "pcm_s16le", "-f", "wav");
  } else {
    args.push("-c:a", "libmp3lame", "-b:a", "128k", "-f", "mp3");
  }

  await runFfmpeg([...args, outputPath]);
  return readFileSync(outputPath);
}

async function convertToRawPcm(inputPath: string, outputDir: string): Promise<Buffer> {
  const outputPath = path.join(outputDir, "telephony.pcm");
  await runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-c:a",
    "pcm_s16le",
    "-ar",
    "16000",
    "-ac",
    "1",
    "-f",
    "s16le",
    outputPath,
  ]);
  return readFileSync(outputPath);
}

export function buildCliSpeechProvider(): SpeechProviderPlugin {
  return {
    id: "tts-local-cli",
    aliases: ["cli"],
    label: "Local CLI",
    autoSelectOrder: 1000,
    resolveConfig(ctx): SpeechProviderConfig {
      return resolveCliProviderConfig(ctx.rawConfig);
    },
    isConfigured(ctx): boolean {
      return getConfig(ctx.providerConfig) !== null;
    },
    async synthesize(req: SpeechSynthesisRequest) {
      const config = getConfig(req.providerConfig);
      if (!config) {
        throw new Error("CLI TTS not configured");
      }

      log.debug?.(`synthesize: text=${req.text.slice(0, 50)}...`);
      const temp = await tempWorkspace({ prefix: "coreblow-cli-tts" });

      try {
        const result = await runCli({
          command: config.command,
          args: config.args ?? [],
          cwd: config.cwd,
          env: config.env,
          timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          text: req.text,
          outputDir: temp.dir,
          filePrefix: "speech",
          outputFormat: config.outputFormat,
        });

        let buffer: Buffer;
        let format: OutputFormat;

        if (req.target === "voice-note") {
          if (result.actualFormat !== "opus") {
            const inputPath =
              result.audioPath ?? path.join(temp.dir, `input${getFileExt(result.actualFormat)}`);
            if (!result.audioPath) {
              writeFileSync(inputPath, result.buffer);
            }
            buffer = await convertAudio(inputPath, temp.dir, "opus");
            format = "opus";
          } else {
            buffer = result.buffer;
            format = "opus";
          }
        } else {
          const desired = config.outputFormat ?? "mp3";
          if (result.actualFormat !== desired) {
            const inputPath =
              result.audioPath ?? path.join(temp.dir, `input${getFileExt(result.actualFormat)}`);
            if (!result.audioPath) {
              writeFileSync(inputPath, result.buffer);
            }
            buffer = await convertAudio(inputPath, temp.dir, desired);
            format = desired;
          } else {
            buffer = result.buffer;
            format = result.actualFormat;
          }
        }

        return {
          audioBuffer: buffer,
          outputFormat: format,
          fileExtension: format === "opus" ? ".ogg" : `.${format}`,
          voiceCompatible: req.target === "voice-note" && format === "opus",
        };
      } finally {
        await temp.cleanup();
      }
    },
    async synthesizeTelephony(req: SpeechTelephonySynthesisRequest) {
      const config = getConfig(req.providerConfig);
      if (!config) {
        throw new Error("CLI TTS not configured");
      }

      log.debug?.(`synthesizeTelephony: text=${req.text.slice(0, 50)}...`);
      const temp = await tempWorkspace({ prefix: "coreblow-cli-tts" });

      try {
        const result = await runCli({
          command: config.command,
          args: config.args ?? [],
          cwd: config.cwd,
          env: config.env,
          timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          text: req.text,
          outputDir: temp.dir,
          filePrefix: "telephony",
          outputFormat: config.outputFormat,
        });

        const inputPath =
          result.audioPath ?? path.join(temp.dir, `input${getFileExt(result.actualFormat)}`);
        if (!result.audioPath) {
          writeFileSync(inputPath, result.buffer);
        }

        return {
          audioBuffer: await convertToRawPcm(inputPath, temp.dir),
          outputFormat: "pcm",
          sampleRate: 16000,
        };
      } finally {
        await temp.cleanup();
      }
    },
  };
}
