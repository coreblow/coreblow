import type { Command } from "commander";
import { danger } from "../globals.js";
import {
  type GmailRunOptions,
  type GmailSetupOptions,
  runGmailService,
  runGmailSetup,
} from "../hooks/gmail-ops.js";
import {
  DEFAULT_GMAIL_LABEL,
  DEFAULT_GMAIL_MAX_BYTES,
  DEFAULT_GMAIL_RENEW_MINUTES,
  DEFAULT_GMAIL_SERVE_BIND,
  DEFAULT_GMAIL_SERVE_PATH,
  DEFAULT_GMAIL_SERVE_PORT,
  DEFAULT_GMAIL_SUBSCRIPTION,
  DEFAULT_GMAIL_TOPIC,
} from "../hooks/gmail.js";
import { t } from "../infra/i18n/index.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";

export function registerWebhooksCli(program: Command) {
  const webhooks = program
    .command("webhooks")
    .description(t("cli_help.webhooks.description"))
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted(t("cli_help.labels.docs"))} ${formatDocsLink("/cli/webhooks", "docs.coreblow.com/cli/webhooks")}\n`,
    );

  const gmail = webhooks.command("gmail").description(t("cli_help.webhooks.gmail.description"));

  gmail
    .command("setup")
    .description(t("cli_help.webhooks.gmail.commands.setup"))
    .requiredOption("--account <email>", t("cli_help.webhooks.gmail.options.account"))
    .option("--project <id>", t("cli_help.webhooks.gmail.options.project"))
    .option("--topic <name>", t("cli_help.webhooks.gmail.options.topic"), DEFAULT_GMAIL_TOPIC)
    .option("--subscription <name>", t("cli_help.webhooks.gmail.options.subscription"), DEFAULT_GMAIL_SUBSCRIPTION)
    .option("--label <label>", t("cli_help.webhooks.gmail.options.label"), DEFAULT_GMAIL_LABEL)
    .option("--hook-url <url>", t("cli_help.webhooks.gmail.options.hook_url"))
    .option("--hook-token <token>", t("cli_help.webhooks.gmail.options.hook_credential"))
    .option("--push-token <token>", t("cli_help.webhooks.gmail.options.push_credential"))
    .option("--bind <host>", t("cli_help.webhooks.gmail.options.bind"), DEFAULT_GMAIL_SERVE_BIND)
    .option("--port <port>", t("cli_help.webhooks.gmail.options.port"), String(DEFAULT_GMAIL_SERVE_PORT))
    .option("--path <path>", t("cli_help.webhooks.gmail.options.path"), DEFAULT_GMAIL_SERVE_PATH)
    .option("--include-body", t("cli_help.webhooks.gmail.options.include_body"), true)
    .option("--max-bytes <n>", t("cli_help.webhooks.gmail.options.max_bytes"), String(DEFAULT_GMAIL_MAX_BYTES))
    .option(
      "--renew-minutes <n>",
      t("cli_help.webhooks.gmail.options.renew_minutes"),
      String(DEFAULT_GMAIL_RENEW_MINUTES),
    )
    .option("--tailscale <mode>", t("cli_help.webhooks.gmail.options.tailscale"), "funnel")
    .option("--tailscale-path <path>", t("cli_help.webhooks.gmail.options.tailscale_path"))
    .option(
      "--tailscale-target <target>",
      t("cli_help.webhooks.gmail.options.tailscale_target"),
    )
    .option("--push-endpoint <url>", t("cli_help.webhooks.gmail.options.push_endpoint"))
    .option("--json", t("cli_help.webhooks.gmail.options.json_summary"), false)
    .action(async (opts) => {
      try {
        const parsed = parseGmailSetupOptions(opts);
        await runGmailSetup(parsed);
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });

  gmail
    .command("run")
    .description(t("cli_help.webhooks.gmail.commands.run"))
    .option("--account <email>", t("cli_help.webhooks.gmail.options.account"))
    .option("--topic <topic>", t("cli_help.webhooks.gmail.options.topic_path"))
    .option("--subscription <name>", t("cli_help.webhooks.gmail.options.subscription"))
    .option("--label <label>", t("cli_help.webhooks.gmail.options.label"))
    .option("--hook-url <url>", t("cli_help.webhooks.gmail.options.hook_url"))
    .option("--hook-token <token>", t("cli_help.webhooks.gmail.options.hook_credential"))
    .option("--push-token <token>", t("cli_help.webhooks.gmail.options.push_credential"))
    .option("--bind <host>", t("cli_help.webhooks.gmail.options.bind"))
    .option("--port <port>", t("cli_help.webhooks.gmail.options.port"))
    .option("--path <path>", t("cli_help.webhooks.gmail.options.path"))
    .option("--include-body", t("cli_help.webhooks.gmail.options.include_body"))
    .option("--max-bytes <n>", t("cli_help.webhooks.gmail.options.max_bytes"))
    .option("--renew-minutes <n>", t("cli_help.webhooks.gmail.options.renew_minutes"))
    .option("--tailscale <mode>", t("cli_help.webhooks.gmail.options.tailscale"))
    .option("--tailscale-path <path>", t("cli_help.webhooks.gmail.options.tailscale_path"))
    .option(
      "--tailscale-target <target>",
      t("cli_help.webhooks.gmail.options.tailscale_target"),
    )
    .action(async (opts) => {
      try {
        const parsed = parseGmailRunOptions(opts);
        await runGmailService(parsed);
      } catch (err) {
        defaultRuntime.error(danger(String(err)));
        defaultRuntime.exit(1);
      }
    });
}

function parseGmailSetupOptions(raw: Record<string, unknown>): GmailSetupOptions {
  const accountRaw = raw.account;
  const account = typeof accountRaw === "string" ? accountRaw.trim() : "";
  if (!account) {
    throw new Error("--account is required");
  }
  const common = parseGmailCommonOptions(raw);
  return {
    account,
    project: stringOption(raw.project),
    ...gmailOptionsFromCommon(common),
    pushEndpoint: stringOption(raw.pushEndpoint),
    json: Boolean(raw.json),
  };
}

function parseGmailRunOptions(raw: Record<string, unknown>): GmailRunOptions {
  const common = parseGmailCommonOptions(raw);
  return {
    account: stringOption(raw.account),
    ...gmailOptionsFromCommon(common),
  };
}

function parseGmailCommonOptions(raw: Record<string, unknown>) {
  return {
    topic: stringOption(raw.topic),
    subscription: stringOption(raw.subscription),
    label: stringOption(raw.label),
    hookUrl: stringOption(raw.hookUrl),
    hookToken: stringOption(raw.hookToken),
    pushToken: stringOption(raw.pushToken),
    bind: stringOption(raw.bind),
    port: numberOption(raw.port),
    path: stringOption(raw.path),
    includeBody: booleanOption(raw.includeBody),
    maxBytes: numberOption(raw.maxBytes),
    renewEveryMinutes: numberOption(raw.renewMinutes),
    tailscaleRaw: stringOption(raw.tailscale),
    tailscalePath: stringOption(raw.tailscalePath),
    tailscaleTarget: stringOption(raw.tailscaleTarget),
  };
}

function gmailOptionsFromCommon(
  common: ReturnType<typeof parseGmailCommonOptions>,
): Omit<GmailRunOptions, "account"> {
  return {
    topic: common.topic,
    subscription: common.subscription,
    label: common.label,
    hookUrl: common.hookUrl,
    hookToken: common.hookToken,
    pushToken: common.pushToken,
    bind: common.bind,
    port: common.port,
    path: common.path,
    includeBody: common.includeBody,
    maxBytes: common.maxBytes,
    renewEveryMinutes: common.renewEveryMinutes,
    tailscale: common.tailscaleRaw as GmailRunOptions["tailscale"],
    tailscalePath: common.tailscalePath,
    tailscaleTarget: common.tailscaleTarget,
  };
}

function stringOption(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function numberOption(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return undefined;
  }
  return Math.floor(n);
}

function booleanOption(value: unknown): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return Boolean(value);
}
