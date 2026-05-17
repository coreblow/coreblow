import type { Command } from "commander";
import { danger } from "../globals.js";
import { t } from "../infra/i18n/index.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { runChannelLogin, runChannelLogout } from "./channel-auth.js";
import { formatCliChannelOptions } from "./channel-options.js";
import { runCommandWithRuntime } from "./cli-utils.js";
import { hasExplicitOptions } from "./command-options.js";
import { formatHelpExamples } from "./help-format.js";

const optionNamesAdd = [
  "channel",
  "account",
  "name",
  "token",
  "privateKey",
  "tokenFile",
  "botToken",
  "appToken",
  "signalNumber",
  "cliPath",
  "dbPath",
  "service",
  "region",
  "authDir",
  "httpUrl",
  "httpHost",
  "httpPort",
  "webhookPath",
  "webhookUrl",
  "audienceType",
  "audience",
  "useEnv",
  "homeserver",
  "userId",
  "accessToken",
  "password",
  "deviceName",
  "initialSyncLimit",
  "ship",
  "url",
  "relayUrls",
  "code",
  "groupChannels",
  "dmAllowlist",
  "autoDiscoverChannels",
] as const;

const optionNamesRemove = ["channel", "account", "delete"] as const;

function runChannelsCommand(action: () => Promise<void>) {
  return runCommandWithRuntime(defaultRuntime, action);
}

function runChannelsCommandWithDanger(action: () => Promise<void>, label: string) {
  return runCommandWithRuntime(defaultRuntime, action, (err) => {
    defaultRuntime.error(danger(`${label}: ${String(err)}`));
    defaultRuntime.exit(1);
  });
}

export function registerChannelsCli(program: Command) {
  const channelNames = formatCliChannelOptions();
  const channels = program
    .command("channels")
    .description(t("cli_help.channels.description"))
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading(t("cli_help.labels.examples"))}\n${formatHelpExamples([
          ["coreblow channels list", t("cli_help.channels.examples.list")],
          ["coreblow channels status --probe", t("cli_help.channels.examples.status_probe")],
          [
            "coreblow channels add --channel telegram --token <token>",
            t("cli_help.channels.examples.add_telegram"),
          ],
          ["coreblow channels login --channel whatsapp", t("cli_help.channels.examples.login_whatsapp")],
        ])}\n\n${theme.muted(t("cli_help.labels.docs"))} ${formatDocsLink(
          "/cli/channels",
          "docs.coreblow.com/cli/channels",
        )}\n`,
    );

  channels
    .command("list")
    .description(t("cli_help.channels.commands.list"))
    .option("--no-usage", t("cli_help.channels.options.no_usage"))
    .option("--json", t("cli_help.options.json_text"), false)
    .action(async (opts) => {
      await runChannelsCommand(async () => {
        const { channelsListCommand } = await import("../commands/channels.js");
        await channelsListCommand(opts, defaultRuntime);
      });
    });

  channels
    .command("status")
    .description(t("cli_help.channels.commands.status"))
    .option("--probe", t("cli_help.channels.options.probe"), false)
    .option("--timeout <ms>", t("cli_help.channels.options.timeout_ms"), "10000")
    .option("--json", t("cli_help.options.json_text"), false)
    .action(async (opts) => {
      await runChannelsCommand(async () => {
        const { channelsStatusCommand } = await import("../commands/channels.js");
        await channelsStatusCommand(opts, defaultRuntime);
      });
    });

  channels
    .command("capabilities")
    .description(t("cli_help.channels.commands.capabilities"))
    .option(
      "--channel <name>",
      t("cli_help.channels.options.channel", { channels: formatCliChannelOptions(["all"]) }),
    )
    .option("--account <id>", t("cli_help.channels.options.account_with_channel"))
    .option("--target <dest>", t("cli_help.channels.options.target"))
    .option("--timeout <ms>", t("cli_help.channels.options.timeout_ms"), "10000")
    .option("--json", t("cli_help.options.json_text"), false)
    .action(async (opts) => {
      await runChannelsCommand(async () => {
        const { channelsCapabilitiesCommand } = await import("../commands/channels.js");
        await channelsCapabilitiesCommand(opts, defaultRuntime);
      });
    });

  channels
    .command("resolve")
    .description(t("cli_help.channels.commands.resolve"))
    .argument("<entries...>", t("cli_help.channels.arguments.entries"))
    .option("--channel <name>", t("cli_help.channels.options.channel", { channels: channelNames }))
    .option("--account <id>", t("cli_help.channels.options.account"))
    .option("--kind <kind>", t("cli_help.channels.options.kind"), "auto")
    .option("--json", t("cli_help.options.json_text"), false)
    .action(async (entries, opts) => {
      await runChannelsCommand(async () => {
        const { channelsResolveCommand } = await import("../commands/channels.js");
        await channelsResolveCommand(
          {
            channel: opts.channel as string | undefined,
            account: opts.account as string | undefined,
            kind: opts.kind as "auto" | "user" | "group",
            json: Boolean(opts.json),
            entries: Array.isArray(entries) ? entries : [String(entries)],
          },
          defaultRuntime,
        );
      });
    });

  channels
    .command("logs")
    .description(t("cli_help.channels.commands.logs"))
    .option(
      "--channel <name>",
      t("cli_help.channels.options.channel", { channels: formatCliChannelOptions(["all"]) }),
      "all",
    )
    .option("--lines <n>", t("cli_help.channels.options.lines"), "200")
    .option("--json", t("cli_help.options.json_text"), false)
    .action(async (opts) => {
      await runChannelsCommand(async () => {
        const { channelsLogsCommand } = await import("../commands/channels.js");
        await channelsLogsCommand(opts, defaultRuntime);
      });
    });

  channels
    .command("add")
    .description(t("cli_help.channels.commands.add"))
    .option("--channel <name>", t("cli_help.channels.options.channel", { channels: channelNames }))
    .option("--account <id>", t("cli_help.channels.add.options.account"))
    .option("--name <name>", t("cli_help.channels.add.options.name"))
    .option("--token <token>", t("cli_help.channels.add.options.credential"))
    .option("--private-key <key>", t("cli_help.channels.add.options.nostr_credential"))
    .option("--token-file <path>", t("cli_help.channels.add.options.credential_file"))
    .option("--bot-token <token>", t("cli_help.channels.add.options.slack_bot_credential"))
    .option("--app-token <token>", t("cli_help.channels.add.options.slack_app_credential"))
    .option("--signal-number <e164>", t("cli_help.channels.add.options.signal_number"))
    .option("--cli-path <path>", t("cli_help.channels.add.options.cli_path"))
    .option("--db-path <path>", t("cli_help.channels.add.options.db_path"))
    .option("--service <service>", t("cli_help.channels.add.options.service"))
    .option("--region <region>", t("cli_help.channels.add.options.region"))
    .option("--auth-dir <path>", t("cli_help.channels.add.options.auth_dir"))
    .option("--http-url <url>", t("cli_help.channels.add.options.http_url"))
    .option("--http-host <host>", t("cli_help.channels.add.options.http_host"))
    .option("--http-port <port>", t("cli_help.channels.add.options.http_port"))
    .option("--webhook-path <path>", t("cli_help.channels.add.options.webhook_path"))
    .option("--webhook-url <url>", t("cli_help.channels.add.options.webhook_url"))
    .option("--audience-type <type>", t("cli_help.channels.add.options.audience_type"))
    .option("--audience <value>", t("cli_help.channels.add.options.audience"))
    .option("--homeserver <url>", t("cli_help.channels.add.options.homeserver"))
    .option("--user-id <id>", t("cli_help.channels.add.options.user_id"))
    .option("--access-token <token>", t("cli_help.channels.add.options.matrix_credential"))
    .option("--password <password>", t("cli_help.channels.add.options.matrix_passphrase"))
    .option("--device-name <name>", t("cli_help.channels.add.options.device_name"))
    .option("--initial-sync-limit <n>", t("cli_help.channels.add.options.initial_sync_limit"))
    .option("--ship <ship>", t("cli_help.channels.add.options.ship"))
    .option("--url <url>", t("cli_help.channels.add.options.url"))
    .option("--relay-urls <list>", t("cli_help.channels.add.options.relay_urls"))
    .option("--code <code>", t("cli_help.channels.add.options.code"))
    .option("--group-channels <list>", t("cli_help.channels.add.options.group_channels"))
    .option("--dm-allowlist <list>", t("cli_help.channels.add.options.dm_allowlist"))
    .option("--auto-discover-channels", t("cli_help.channels.add.options.auto_discover_channels"))
    .option("--no-auto-discover-channels", t("cli_help.channels.add.options.no_auto_discover_channels"))
    .option("--use-env", t("cli_help.channels.add.options.use_env"), false)
    .action(async (opts, command) => {
      await runChannelsCommand(async () => {
        const { channelsAddCommand } = await import("../commands/channels.js");
        const hasFlags = hasExplicitOptions(command, optionNamesAdd);
        await channelsAddCommand(opts, defaultRuntime, { hasFlags });
      });
    });

  channels
    .command("remove")
    .description(t("cli_help.channels.commands.remove"))
    .option("--channel <name>", t("cli_help.channels.options.channel", { channels: channelNames }))
    .option("--account <id>", t("cli_help.channels.add.options.account"))
    .option("--delete", t("cli_help.channels.options.delete"), false)
    .action(async (opts, command) => {
      await runChannelsCommand(async () => {
        const { channelsRemoveCommand } = await import("../commands/channels.js");
        const hasFlags = hasExplicitOptions(command, optionNamesRemove);
        await channelsRemoveCommand(opts, defaultRuntime, { hasFlags });
      });
    });

  channels
    .command("login")
    .description(t("cli_help.channels.commands.login"))
    .option("--channel <channel>", t("cli_help.channels.options.channel_alias"))
    .option("--account <id>", t("cli_help.channels.options.account"))
    .option("--verbose", t("cli_help.channels.options.verbose_connection"), false)
    .action(async (opts) => {
      await runChannelsCommandWithDanger(async () => {
        await runChannelLogin(
          {
            channel: opts.channel as string | undefined,
            account: opts.account as string | undefined,
            verbose: Boolean(opts.verbose),
          },
          defaultRuntime,
        );
      }, t("cli_help.channels.errors.login_failed"));
    });

  channels
    .command("logout")
    .description(t("cli_help.channels.commands.logout"))
    .option("--channel <channel>", t("cli_help.channels.options.channel_alias"))
    .option("--account <id>", t("cli_help.channels.options.account"))
    .action(async (opts) => {
      await runChannelsCommandWithDanger(async () => {
        await runChannelLogout(
          {
            channel: opts.channel as string | undefined,
            account: opts.account as string | undefined,
          },
          defaultRuntime,
        );
      }, t("cli_help.channels.errors.logout_failed"));
    });
}
