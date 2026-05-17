import type { Command } from "commander";
import { sandboxExplainCommand } from "../commands/sandbox-explain.js";
import { sandboxListCommand, sandboxRecreateCommand } from "../commands/sandbox.js";
import { t } from "../infra/i18n/index.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { formatHelpExamples } from "./help-format.js";

// --- Types ---

type CommandOptions = Record<string, unknown>;

// --- Helpers ---

const SANDBOX_EXAMPLES = {
  main: [
    ["coreblow sandbox list", "list_all"],
    ["coreblow sandbox list --browser", "list_browser"],
    ["coreblow sandbox recreate --all", "recreate_all"],
    ["coreblow sandbox recreate --session main", "recreate_session"],
    ["coreblow sandbox recreate --agent mybot", "recreate_agent"],
    ["coreblow sandbox explain", "explain_config"],
  ],
  list: [
    ["coreblow sandbox list", "list_all"],
    ["coreblow sandbox list --browser", "list_browser"],
    ["coreblow sandbox list --json", "json_output"],
  ],
  recreate: [
    ["coreblow sandbox recreate --all", "recreate_all"],
    ["coreblow sandbox recreate --session main", "recreate_session"],
    ["coreblow sandbox recreate --agent mybot", "recreate_agent_specific"],
    ["coreblow sandbox recreate --browser --all", "recreate_browser"],
    ["coreblow sandbox recreate --all --force", "skip_confirmation"],
  ],
  explain: [
    ["coreblow sandbox explain", "show_effective"],
    ["coreblow sandbox explain --session agent:main:main", "explain_session"],
    ["coreblow sandbox explain --agent work", "explain_agent"],
    ["coreblow sandbox explain --json", "json_output"],
  ],
} as const;

function sandboxExamples(
  examples: readonly (readonly [string, keyof typeof SANDBOX_EXAMPLE_FALLBACKS])[],
) {
  return formatHelpExamples(
    examples.map(([cmd, key]) => [
      cmd,
      t(`cli_help.sandbox.examples.${key}`),
    ]),
  );
}

const SANDBOX_EXAMPLE_FALLBACKS = {
  list_all: true,
  list_browser: true,
  recreate_all: true,
  recreate_session: true,
  recreate_agent: true,
  explain_config: true,
  json_output: true,
  recreate_agent_specific: true,
  recreate_browser: true,
  skip_confirmation: true,
  show_effective: true,
  explain_session: true,
  explain_agent: true,
} as const;

function createRunner(
  commandFn: (opts: CommandOptions, runtime: typeof defaultRuntime) => Promise<void>,
) {
  return async (opts: CommandOptions) => {
    try {
      await commandFn(opts, defaultRuntime);
    } catch (err) {
      defaultRuntime.error(String(err));
      defaultRuntime.exit(1);
    }
  };
}

// --- Registration ---

export function registerSandboxCli(program: Command) {
  const sandbox = program
    .command("sandbox")
    .description(t("cli_help.sandbox.description"))
    .addHelpText(
      "after",
      () => `\n${theme.heading(t("cli_help.labels.examples"))}\n${sandboxExamples(SANDBOX_EXAMPLES.main)}\n`,
    )
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted(t("cli_help.labels.docs"))} ${formatDocsLink("/cli/sandbox", "docs.coreblow.com/cli/sandbox")}\n`,
    )
    .action(() => {
      sandbox.help({ error: true });
    });

  // --- List Command ---

  sandbox
    .command("list")
    .description(t("cli_help.sandbox.commands.list"))
    .option("--json", t("cli_help.options.json_text"), false)
    .option("--browser", t("cli_help.sandbox.options.browser"), false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading(t("cli_help.labels.examples"))}\n${sandboxExamples(SANDBOX_EXAMPLES.list)}\n\n${theme.heading(
          t("cli_help.sandbox.output.title"),
        )}\n${theme.muted(t("cli_help.sandbox.output.container"))}\n${theme.muted(
          t("cli_help.sandbox.output.image"),
        )}\n${theme.muted(t("cli_help.sandbox.output.age"))}\n${theme.muted(
          t("cli_help.sandbox.output.idle"),
        )}\n${theme.muted(t("cli_help.sandbox.output.session"))}`,
    )
    .action(
      createRunner((opts) =>
        sandboxListCommand(
          {
            browser: Boolean(opts.browser),
            json: Boolean(opts.json),
          },
          defaultRuntime,
        ),
      ),
    );

  // --- Recreate Command ---

  sandbox
    .command("recreate")
    .description(t("cli_help.sandbox.commands.recreate"))
    .option("--all", t("cli_help.sandbox.options.all"), false)
    .option("--session <key>", t("cli_help.sandbox.options.session"))
    .option("--agent <id>", t("cli_help.sandbox.options.agent"))
    .option("--browser", t("cli_help.sandbox.options.browser_only"), false)
    .option("--force", t("cli_help.sandbox.options.force"), false)
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading(t("cli_help.labels.examples"))}\n${sandboxExamples(SANDBOX_EXAMPLES.recreate)}\n\n${theme.heading(
          t("cli_help.sandbox.why.title"),
        )}\n${theme.muted(
          t("cli_help.sandbox.why.old_settings"),
        )}\n${theme.muted(
          t("cli_help.sandbox.why.recreate"),
        )}\n\n${theme.heading(t("cli_help.sandbox.filter_options"))}\n${theme.muted(
          t("cli_help.sandbox.filter_all"),
        )}\n${theme.muted(
          t("cli_help.sandbox.filter_session"),
        )}\n${theme.muted(
          t("cli_help.sandbox.filter_agent"),
        )}\n\n${theme.heading(t("cli_help.sandbox.modifiers"))}\n${theme.muted(
          t("cli_help.sandbox.modifier_browser"),
        )}\n${theme.muted(t("cli_help.sandbox.modifier_force"))}`,
    )
    .action(
      createRunner((opts) =>
        sandboxRecreateCommand(
          {
            all: Boolean(opts.all),
            session: opts.session as string | undefined,
            agent: opts.agent as string | undefined,
            browser: Boolean(opts.browser),
            force: Boolean(opts.force),
          },
          defaultRuntime,
        ),
      ),
    );

  // --- Explain Command ---

  sandbox
    .command("explain")
    .description(t("cli_help.sandbox.commands.explain"))
    .option("--session <key>", t("cli_help.sandbox.options.session_inspect"))
    .option("--agent <id>", t("cli_help.sandbox.options.agent_inspect"))
    .option("--json", t("cli_help.options.json_text"), false)
    .addHelpText(
      "after",
      () => `\n${theme.heading(t("cli_help.labels.examples"))}\n${sandboxExamples(SANDBOX_EXAMPLES.explain)}\n`,
    )
    .action(
      createRunner((opts) =>
        sandboxExplainCommand(
          {
            session: opts.session as string | undefined,
            agent: opts.agent as string | undefined,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        ),
      ),
    );
}
