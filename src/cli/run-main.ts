import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { resolveConfigPath, resolveStateDir } from "../config/paths.js";
import { isTruthyEnvValue, normalizeEnv } from "../infra/env.js";
import { formatUncaughtError } from "../infra/errors.js";
import { i18n } from "../infra/i18n/index.js";
import { isMainModule } from "../infra/is-main.js";
import { ensureCoreBlowCliOnPath } from "../infra/path-env.js";
import { assertSupportedRuntime } from "../infra/runtime-guard.js";
import { enableConsoleCapture } from "../logging.js";
import { hasMemoryRuntime } from "../plugins/memory-state.js";
import {
  getCommandPathWithRootOptions,
  getFlagValue,
  getPrimaryCommand,
  hasFlag,
  hasHelpOrVersion,
  isRootHelpInvocation,
} from "./argv.js";
import { maybeRunCliInContainer, parseCliContainerArgs } from "./container-target.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./profile.js";
import { tryRouteCli } from "./route.js";
import { normalizeWindowsArgv } from "./windows-argv.js";

async function closeCliMemoryManagers(): Promise<void> {
  if (!hasMemoryRuntime()) {
    return;
  }
  try {
    const { closeActiveMemorySearchManagers } = await import("../plugins/memory-runtime.js");
    await closeActiveMemorySearchManagers();
  } catch {
    // Best-effort teardown for short-lived CLI processes.
  }
}

export function rewriteUpdateFlagArgv(argv: string[]): string[] {
  const index = argv.indexOf("--update");
  if (index === -1) {
    return argv;
  }

  const next = [...argv];
  next.splice(index, 1, "update");
  return next;
}

export function shouldRegisterPrimarySubcommand(argv: string[]): boolean {
  return !hasHelpOrVersion(argv);
}

export function shouldSkipPluginCommandRegistration(params: {
  argv: string[];
  primary: string | null;
  hasBuiltinPrimary: boolean;
}): boolean {
  if (params.hasBuiltinPrimary) {
    return true;
  }
  if (!params.primary) {
    return hasHelpOrVersion(params.argv);
  }
  return false;
}

export function shouldEnsureCliPath(argv: string[]): boolean {
  if (hasHelpOrVersion(argv)) {
    return false;
  }
  const [primary, secondary] = getCommandPathWithRootOptions(argv, 2);
  if (!primary) {
    return true;
  }
  if (primary === "status" || primary === "health" || primary === "sessions") {
    return false;
  }
  if (primary === "config" && (secondary === "get" || secondary === "unset")) {
    return false;
  }
  if (primary === "models" && (secondary === "list" || secondary === "status")) {
    return false;
  }
  return true;
}

export function shouldUseRootHelpFastPath(argv: string[]): boolean {
  return isRootHelpInvocation(argv);
}

const KNOWN_ROOT_OR_HEADLESS_VALUE_FLAGS = new Set([
  "-p",
  "--print",
  "-q",
  "--query",
  "--output-format",
  "--model",
  "--permission-mode",
  "--backend",
  "--backend-target",
  "--max-turns",
  "--container",
  "--log-level",
  "--profile",
  "-r",
  "--resume",
]);

const KNOWN_ROOT_OR_HEADLESS_BOOL_FLAGS = new Set([
  "--bare",
  "--go",
  "--simple",
  "-c",
  "--continue",
  "--dev",
  "--no-color",
  "-h",
  "--help",
  "-V",
  "--version",
]);

function hasUnknownRootOrHeadlessFlag(argv: string[]): boolean {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--") {
      break;
    }
    if (!arg.startsWith("-") || arg === "-") {
      continue;
    }
    const eqIdx = arg.indexOf("=");
    const flagName = eqIdx === -1 ? arg : arg.slice(0, eqIdx);
    if (KNOWN_ROOT_OR_HEADLESS_VALUE_FLAGS.has(flagName)) {
      if (eqIdx === -1) {
        i += 1;
      }
      continue;
    }
    if (KNOWN_ROOT_OR_HEADLESS_BOOL_FLAGS.has(flagName)) {
      continue;
    }
    return true;
  }
  return false;
}

export function shouldDivertToHeadless(params: {
  argv: string[];
  isPipedStdin: boolean;
  primaryCommand: string | null;
}): boolean {
  const printPrompt =
    getFlagValue(params.argv, "-p") ?? getFlagValue(params.argv, "--print");
  const outputFormat = getFlagValue(params.argv, "--output-format");
  return Boolean(
    printPrompt !== undefined ||
      outputFormat !== undefined ||
      (params.isPipedStdin &&
        params.primaryCommand === null &&
        !hasHelpOrVersion(params.argv) &&
        !hasUnknownRootOrHeadlessFlag(params.argv)),
  );
}

class FirstRunOnboardCancelledError extends Error {
  constructor() {
    super("First-run onboarding cancelled");
  }
}

export function shouldAutoRunFirstRunOnboard(params: {
  argv: string[];
  isInteractiveTty: boolean;
  primaryCommand: string | null;
  env?: NodeJS.ProcessEnv;
  configExists?: boolean;
}): boolean {
  const env = params.env ?? process.env;
  if (params.primaryCommand !== null) {
    return false;
  }
  if (hasHelpOrVersion(params.argv) || hasUnknownRootOrHeadlessFlag(params.argv)) {
    return false;
  }
  if (!params.isInteractiveTty || Boolean(env.VITEST) || isTruthyEnvValue(env.CI)) {
    return false;
  }
  if (
    hasFlag(params.argv, "--bare") ||
    hasFlag(params.argv, "--go") ||
    hasFlag(params.argv, "-c") ||
    hasFlag(params.argv, "--continue") ||
    hasFlag(params.argv, "-r") ||
    hasFlag(params.argv, "--resume")
  ) {
    return false;
  }
  const configExists = params.configExists ?? existsSync(resolveConfigPath(env));
  return !configExists;
}

export function resolveSessionResumeParams(argv: string[]): {
  continueFlag: boolean;
  hasResume: boolean;
  resumeValue: string | undefined;
  initialModal: "none" | "sessions";
} {
  const continueFlag = hasFlag(argv, "-c") || hasFlag(argv, "--continue");
  const rawR = getFlagValue(argv, "-r");
  const rawResume = getFlagValue(argv, "--resume");
  const resumeValue =
    typeof rawR === "string"
      ? rawR
      : typeof rawResume === "string"
        ? rawResume
        : undefined;
  const hasResume = hasFlag(argv, "-r") || hasFlag(argv, "--resume") || Boolean(resumeValue);

  let initialModal: "none" | "sessions" = "none";
  if (!continueFlag && hasResume && !resumeValue) {
    initialModal = "sessions";
  }

  return { continueFlag, hasResume, resumeValue, initialModal };
}

function shouldLoadCliDotEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  if (existsSync(path.join(process.cwd(), ".env"))) {
    return true;
  }
  return existsSync(path.join(resolveStateDir(env), ".env"));
}

export async function runCli(argv: string[] = process.argv) {
  const originalArgv = normalizeWindowsArgv(argv);
  const parsedContainer = parseCliContainerArgs(originalArgv);
  if (!parsedContainer.ok) {
    throw new Error(parsedContainer.error);
  }
  const parsedProfile = parseCliProfileArgs(parsedContainer.argv);
  if (!parsedProfile.ok) {
    throw new Error(parsedProfile.error);
  }
  if (parsedProfile.profile) {
    applyCliProfileEnv({ profile: parsedProfile.profile });
  }
  const containerTargetName =
    parsedContainer.container ?? process.env.COREBLOW_CONTAINER?.trim() ?? null;
  if (containerTargetName && parsedProfile.profile) {
    throw new Error("--container cannot be combined with --profile/--dev");
  }

  const containerTarget = maybeRunCliInContainer(originalArgv);
  if (containerTarget.handled) {
    if (containerTarget.exitCode !== 0) {
      process.exitCode = containerTarget.exitCode;
    }
    return;
  }
  let normalizedArgv = parsedProfile.argv;

  if (shouldLoadCliDotEnv()) {
    const { loadCliDotEnv } = await import("./dotenv.js");
    loadCliDotEnv({ quiet: true });
  }
  normalizeEnv();
  await i18n.initialize();
  if (shouldEnsureCliPath(normalizedArgv)) {
    ensureCoreBlowCliOnPath();
  }

  // Enforce the minimum supported runtime before doing any work.
  assertSupportedRuntime();

  try {
    if (shouldUseRootHelpFastPath(normalizedArgv)) {
      const { outputRootHelp } = await import("./program/root-help.js");
      outputRootHelp();
      return;
    }

    const primaryCommand = getPrimaryCommand(normalizedArgv);

    const isPipedStdin = Boolean(!process.stdin.isTTY && !process.env.VITEST);

    if (shouldDivertToHeadless({ argv: normalizedArgv, isPipedStdin, primaryCommand })) {
      const { runHeadlessCli } = await import("./headless-runner.js");
      await runHeadlessCli(normalizedArgv);
      return;
    }

    const queryPrompt =
      getFlagValue(normalizedArgv, "-q") ?? getFlagValue(normalizedArgv, "--query");
    if (queryPrompt !== undefined) {
      if (typeof queryPrompt === "string" && queryPrompt.trim()) {
        const { runOneShotCliQuery } = await import("./interactive-chat.js");
        await runOneShotCliQuery(queryPrompt.trim());
        return;
      }
      console.error("error: missing required argument for -q/--query");
      process.exitCode = 1;
      return;
    }

    if (primaryCommand === "ask" && !hasHelpOrVersion(normalizedArgv)) {
      const askIndex = normalizedArgv.indexOf("ask");
      const askPrompt = normalizedArgv.slice(askIndex + 1).join(" ").trim();
      if (askPrompt) {
        const { runOneShotCliQuery } = await import("./interactive-chat.js");
        await runOneShotCliQuery(askPrompt);
        return;
      }
    }

    if (
      primaryCommand === null &&
      !hasHelpOrVersion(normalizedArgv) &&
      !hasUnknownRootOrHeadlessFlag(normalizedArgv)
    ) {
      const isInteractiveTty = Boolean(
        process.stdin.isTTY && process.stdout.isTTY && !process.env.VITEST,
      );
      if (isInteractiveTty) {
        if (
          shouldAutoRunFirstRunOnboard({
            argv: normalizedArgv,
            isInteractiveTty,
            primaryCommand,
          })
        ) {
          const [{ onboardCommand }, { defaultRuntime }] = await Promise.all([
            import("../commands/onboard.js"),
            import("../runtime.js"),
          ]);
          try {
            await onboardCommand(
              {},
              {
                ...defaultRuntime,
                exit: (code: number) => {
                  if (code === 0 || code === 1) {
                    throw new FirstRunOnboardCancelledError();
                  }
                  defaultRuntime.exit(code);
                },
              },
            );
          } catch (err) {
            if (err instanceof FirstRunOnboardCancelledError) {
              return;
            }
            throw err;
          }
          if (!existsSync(resolveConfigPath(process.env))) {
            return;
          }
        }

        // Session resume flags: -c / --continue or -r / --resume
        const { continueFlag, hasResume, resumeValue, initialModal: initialModalFromResume } =
          resolveSessionResumeParams(normalizedArgv);

        let targetSessionId: string | undefined;
        let initialModal: any = initialModalFromResume;

        if (continueFlag) {
          const { resolveLatestSessionForCwd } = await import("./session-resume.js");
          const latest = resolveLatestSessionForCwd();
          if (latest) {
            targetSessionId = latest.id;
          }
        } else if (hasResume) {
          if (resumeValue) {
            const { resolveSessionByIdOrQuery } = await import("./session-resume.js");
            const found = resolveSessionByIdOrQuery(resumeValue);
            if (found) {
              targetSessionId = found.id;
            } else {
              console.error(`[coreblow] Error: Session not found matching "${resumeValue}".`);
              process.exitCode = 1;
              return;
            }
          }
        }

        const backendType = getFlagValue(normalizedArgv, "--backend") as any;
        const backendTarget = getFlagValue(normalizedArgv, "--backend-target") || undefined;

        if (normalizedArgv.includes("--go")) {
          const { runChatGoHandoff } = await import("./chat-go-handoff.js");
          const ok = await runChatGoHandoff(undefined, {
            sessionKey: targetSessionId,
          });
          if (!ok) {
            process.exitCode = 1;
          }
          return;
        }

        if (!normalizedArgv.includes("--simple")) {
          try {
            const { runTui } = await import("../tui/tui.js");
            await runTui({
              session: targetSessionId,
              initialModal,
              backendType,
              backendTarget,
            });
            return;
          } catch (err) {
            console.error(
              `[coreblow] Notice: TUI unavailable (${err instanceof Error ? err.message : String(err)}); falling back to simple chat.`,
            );
          }
        }
        const { runInteractiveCliChat } = await import("./interactive-chat.js");
        await runInteractiveCliChat();
        return;
      }
      const { outputRootHelp } = await import("./program/root-help.js");
      outputRootHelp();
      return;
    }

    if (await tryRouteCli(normalizedArgv)) {
      return;
    }

    // Capture all console output into structured logs while keeping stdout/stderr behavior.
    if (!hasHelpOrVersion(normalizedArgv)) {
      enableConsoleCapture();
    }

    const { buildProgram } = await import("./program.js");
    const program = buildProgram();
    const { installUnhandledRejectionHandler } = await import("../infra/unhandled-rejections.js");

    // Global error handlers to prevent silent crashes from unhandled rejections/exceptions.
    // These log the error and exit gracefully instead of crashing without trace.
    installUnhandledRejectionHandler();

    process.on("uncaughtException", (error) => {
      console.error("[coreblow] Uncaught exception:", formatUncaughtError(error));
      process.exit(1);
    });

    const parseArgv = rewriteUpdateFlagArgv(normalizedArgv);
    // Register the primary command (builtin or subcli) so help and command parsing
    // are correct even with lazy command registration.
    const primary = getPrimaryCommand(parseArgv);
    if (primary) {
      const { getProgramContext } = await import("./program/program-context.js");
      const ctx = getProgramContext(program);
      if (ctx) {
        const { registerCoreCliByName } = await import("./program/command-registry.js");
        await registerCoreCliByName(program, ctx, primary, parseArgv);
      }
      const { registerSubCliByName } = await import("./program/register.subclis.js");
      await registerSubCliByName(program, primary, parseArgv);
    }

    const hasBuiltinPrimary =
      primary !== null && program.commands.some((command) => command.name() === primary);
    const shouldSkipPluginRegistration = shouldSkipPluginCommandRegistration({
      argv: parseArgv,
      primary,
      hasBuiltinPrimary,
    });
    if (!shouldSkipPluginRegistration) {
      // Register plugin CLI commands before parsing
      const { registerPluginCliCommands } = await import("../plugins/cli.js");
      const { loadValidatedConfigForPluginRegistration } =
        await import("./program/register.subclis.js");
      const config = await loadValidatedConfigForPluginRegistration();
      if (config) {
        registerPluginCliCommands(program, config);
      }
    }

    await program.parseAsync(parseArgv);
  } finally {
    await closeCliMemoryManagers();
  }
}

export function isCliMainModule(): boolean {
  return isMainModule({ currentFile: fileURLToPath(import.meta.url) });
}
