import type { Command } from "commander";
import { healthCommand } from "../../commands/health.js";
import { sessionsCleanupCommand } from "../../commands/sessions-cleanup.js";
import { sessionsCommand } from "../../commands/sessions.js";
import { statusCommand } from "../../commands/status.js";
import { setVerbose } from "../../globals.js";
import { t } from "../../infra/i18n/index.js";
import { defaultRuntime } from "../../runtime.js";
import { formatDocsLink } from "../../terminal/links.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";
import { formatHelpExamples } from "../help-format.js";
import { parsePositiveIntOrUndefined } from "./helpers.js";

function resolveVerbose(opts: { verbose?: boolean; debug?: boolean }): boolean {
  return Boolean(opts.verbose || opts.debug);
}

function parseTimeoutMs(timeout: unknown): number | null | undefined {
  const parsed = parsePositiveIntOrUndefined(timeout);
  if (timeout !== undefined && parsed === undefined) {
    defaultRuntime.error(t("cli_help.errors.timeout_positive_integer"));
    defaultRuntime.exit(1);
    return null;
  }
  return parsed;
}

async function runWithVerboseAndTimeout(
  opts: { verbose?: boolean; debug?: boolean; timeout?: unknown },
  action: (params: { verbose: boolean; timeoutMs: number | undefined }) => Promise<void>,
): Promise<void> {
  const verbose = resolveVerbose(opts);
  setVerbose(verbose);
  const timeoutMs = parseTimeoutMs(opts.timeout);
  if (timeoutMs === null) {
    return;
  }
  await runCommandWithRuntime(defaultRuntime, async () => {
    await action({ verbose, timeoutMs });
  });
}

export function registerStatusHealthSessionsCommands(program: Command) {
  program
    .command("status")
    .description(t("cli_help.commands.status"))
    .option("--json", t("cli_help.options.json_text"), false)
    .option("--all", t("cli_help.status.options.all"), false)
    .option("--usage", t("cli_help.status.options.usage"), false)
    .option("--deep", t("cli_help.status.options.deep"), false)
    .option("--timeout <ms>", t("cli_help.status.options.timeout"), "10000")
    .option("--verbose", t("cli_help.options.verbose"), false)
    .option("--debug", t("cli_help.options.debug_verbose"), false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading(t("cli_help.labels.examples"))}\n${formatHelpExamples([
          ["coreblow status", t("cli_help.status.examples.default")],
          ["coreblow status --all", t("cli_help.status.examples.all")],
          ["coreblow status --json", t("cli_help.status.examples.json")],
          ["coreblow status --usage", t("cli_help.status.examples.usage")],
          [
            "coreblow status --deep",
            t("cli_help.status.examples.deep"),
          ],
          ["coreblow status --deep --timeout 5000", t("cli_help.status.examples.timeout")],
        ])}`,
    )
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted(t("cli_help.labels.docs"))} ${formatDocsLink("/cli/status", "docs.coreblow.com/cli/status")}\n`,
    )
    .action(async (opts) => {
      await runWithVerboseAndTimeout(opts, async ({ verbose, timeoutMs }) => {
        await statusCommand(
          {
            json: Boolean(opts.json),
            all: Boolean(opts.all),
            deep: Boolean(opts.deep),
            usage: Boolean(opts.usage),
            timeoutMs,
            verbose,
          },
          defaultRuntime,
        );
      });
    });

  program
    .command("health")
    .description(t("cli_help.commands.health"))
    .option("--json", t("cli_help.options.json_text"), false)
    .option("--timeout <ms>", t("cli_help.health.options.timeout"), "10000")
    .option("--verbose", t("cli_help.options.verbose"), false)
    .option("--debug", t("cli_help.options.debug_verbose"), false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted(t("cli_help.labels.docs"))} ${formatDocsLink("/cli/health", "docs.coreblow.com/cli/health")}\n`,
    )
    .action(async (opts) => {
      await runWithVerboseAndTimeout(opts, async ({ verbose, timeoutMs }) => {
        await healthCommand(
          {
            json: Boolean(opts.json),
            timeoutMs,
            verbose,
          },
          defaultRuntime,
        );
      });
    });

  const sessionsCmd = program
    .command("sessions")
    .description("List stored conversation sessions")
    .option("--json", "Output as JSON", false)
    .option("--verbose", "Verbose logging", false)
    .option("--store <path>", "Path to session store (default: resolved from config)")
    .option("--agent <id>", "Agent id to inspect (default: configured default agent)")
    .option("--all-agents", "Aggregate sessions across all configured agents", false)
    .option("--active <minutes>", "Only show sessions updated within the past N minutes")
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading(t("cli_help.labels.examples"))}\n${formatHelpExamples([
          ["coreblow sessions", t("cli_help.sessions.examples.list")],
          ["coreblow sessions --agent work", t("cli_help.sessions.examples.agent")],
          ["coreblow sessions --all-agents", t("cli_help.sessions.examples.all_agents")],
          ["coreblow sessions --active 120", t("cli_help.sessions.examples.active")],
          ["coreblow sessions --json", t("cli_help.sessions.examples.json")],
          ["coreblow sessions --store ./tmp/sessions.json", t("cli_help.sessions.examples.store")],
        ])}\n\n${theme.muted(
          t("cli_help.sessions.note"),
        )}`,
    )
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted(t("cli_help.labels.docs"))} ${formatDocsLink("/cli/sessions", "docs.coreblow.com/cli/sessions")}\n`,
    )
    .action(async (opts) => {
      setVerbose(Boolean(opts.verbose));
      await sessionsCommand(
        {
          json: Boolean(opts.json),
          store: opts.store as string | undefined,
          agent: opts.agent as string | undefined,
          allAgents: Boolean(opts.allAgents),
          active: opts.active as string | undefined,
        },
        defaultRuntime,
      );
    });
  sessionsCmd.enablePositionalOptions();

  sessionsCmd
    .command("cleanup")
    .description("Run session-store maintenance now")
    .option("--store <path>", "Path to session store (default: resolved from config)")
    .option("--agent <id>", "Agent id to maintain (default: configured default agent)")
    .option("--all-agents", "Run maintenance across all configured agents", false)
    .option("--dry-run", "Preview maintenance actions without writing", false)
    .option("--enforce", "Apply maintenance even when configured mode is warn", false)
    .option(
      "--fix-missing",
      "Remove store entries whose transcript files are missing (bypasses age/count retention)",
      false,
    )
    .option("--active-key <key>", "Protect this session key from budget-eviction")
    .option("--json", "Output JSON", false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading(t("cli_help.labels.examples"))}\n${formatHelpExamples([
          ["coreblow sessions cleanup --dry-run", t("cli_help.sessions.cleanup_examples.dry_run")],
          [
            "coreblow sessions cleanup --dry-run --fix-missing",
            t("cli_help.sessions.cleanup_examples.fix_missing"),
          ],
          ["coreblow sessions cleanup --enforce", t("cli_help.sessions.cleanup_examples.enforce")],
          ["coreblow sessions cleanup --agent work --dry-run", t("cli_help.sessions.cleanup_examples.agent")],
          ["coreblow sessions cleanup --all-agents --dry-run", t("cli_help.sessions.cleanup_examples.all_agents")],
          [
            "coreblow sessions cleanup --enforce --store ./tmp/sessions.json",
            t("cli_help.sessions.cleanup_examples.store"),
          ],
        ])}`,
    )
    .action(async (opts, command) => {
      const parentOpts = command.parent?.opts() as
        | {
            store?: string;
            agent?: string;
            allAgents?: boolean;
            json?: boolean;
          }
        | undefined;
      await runCommandWithRuntime(defaultRuntime, async () => {
        await sessionsCleanupCommand(
          {
            store: (opts.store as string | undefined) ?? parentOpts?.store,
            agent: (opts.agent as string | undefined) ?? parentOpts?.agent,
            allAgents: Boolean(opts.allAgents || parentOpts?.allAgents),
            dryRun: Boolean(opts.dryRun),
            enforce: Boolean(opts.enforce),
            fixMissing: Boolean(opts.fixMissing),
            activeKey: opts.activeKey as string | undefined,
            json: Boolean(opts.json || parentOpts?.json),
          },
          defaultRuntime,
        );
      });
    });
}
