import type { Command } from "commander";
import { t } from "../infra/i18n/index.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { runTui } from "../tui/tui.js";
import { parseTimeoutMs } from "./parse-timeout.js";

export function registerTuiCli(program: Command) {
  program
    .command("tui")
    .description(t("cli_help.tui.description"))
    .option("--url <url>", t("cli_help.tui.options.url"))
    .option("--token <token>", t("cli_help.tui.options.credential"))
    .option("--password <password>", t("cli_help.tui.options.passphrase"))
    .option("--session <key>", t("cli_help.tui.options.session"))
    .option("--deliver", t("cli_help.tui.options.deliver"), false)
    .option("--thinking <level>", t("cli_help.tui.options.thinking"))
    .option("--message <text>", t("cli_help.tui.options.message"))
    .option("--timeout-ms <ms>", t("cli_help.tui.options.timeout_ms"))
    .option("--history-limit <n>", t("cli_help.tui.options.history_limit"), "200")
    .addHelpText(
      "after",
      () => `\n${theme.muted(t("cli_help.labels.docs"))} ${formatDocsLink("/cli/tui", "docs.coreblow.com/cli/tui")}\n`,
    )
    .action(async (opts) => {
      try {
        const timeoutMs = parseTimeoutMs(opts.timeoutMs);
        if (opts.timeoutMs !== undefined && timeoutMs === undefined) {
          defaultRuntime.error(
            `warning: invalid --timeout-ms "${String(opts.timeoutMs)}"; ignoring`,
          );
        }
        const historyLimit = Number.parseInt(String(opts.historyLimit ?? "200"), 10);
        await runTui({
          url: opts.url as string | undefined,
          token: opts.token as string | undefined,
          password: opts.password as string | undefined,
          session: opts.session as string | undefined,
          deliver: Boolean(opts.deliver),
          thinking: opts.thinking as string | undefined,
          message: opts.message as string | undefined,
          timeoutMs,
          historyLimit: Number.isNaN(historyLimit) ? undefined : historyLimit,
        });
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });
}
