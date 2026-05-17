import type { Argument, Command, Option } from "commander";
import { resolveCommitHash } from "../../infra/git-commit.js";
import { t } from "../../infra/i18n/index.js";
import { formatDocsLink } from "../../terminal/links.js";
import { isRich, theme } from "../../terminal/theme.js";
import { escapeRegExp } from "../../utils.js";
import { hasFlag, hasRootVersionAlias } from "../argv.js";
import { formatCliBannerLine, hasEmittedCliBanner } from "../banner.js";
import { replaceCliName, resolveCliName } from "../cli-name.js";
import { CLI_LOG_LEVEL_VALUES, parseCliLogLevelOption } from "../log-level-option.js";
import type { ProgramContext } from "./context.js";
import { getCoreCliCommandsWithSubcommands } from "./command-registry.js";
import { getSubCliCommandsWithSubcommands } from "./register.subclis.js";
import { translateHelpText } from "./help-text-translations.js";

const CLI_NAME = resolveCliName();
const CLI_NAME_PATTERN = escapeRegExp(CLI_NAME);
const ROOT_COMMANDS_WITH_SUBCOMMANDS = new Set([
  ...getCoreCliCommandsWithSubcommands(),
  ...getSubCliCommandsWithSubcommands(),
]);

const EXAMPLES = [
  ["coreblow models --help", "models_help", "Show detailed help for the models command."],
  ["coreblow channels login --verbose", "channels_login", "Link personal WhatsApp Web and show QR + connection logs."],
  [
    'coreblow message send --target +15555550123 --message "Hi" --json',
    "message_web_json",
    "Send via your web session and print JSON result.",
  ],
  ["coreblow gateway --port 18789", "gateway_local", "Run the WebSocket Gateway locally."],
  [
    "coreblow --dev gateway",
    "gateway_dev",
    "Run a dev Gateway (isolated state/config) on ws://127.0.0.1:19001.",
  ],
  [
    "coreblow gateway --force",
    "gateway_force",
    "Kill anything bound to the default gateway port, then start it.",
  ],
  ["coreblow gateway ...", "gateway_control", "Gateway control via WebSocket."],
  [
    'coreblow agent --to +15555550123 --message "Run summary" --deliver',
    "agent_deliver",
    "Talk directly to the agent using the Gateway; optionally send the WhatsApp reply.",
  ],
  [
    'coreblow message send --channel telegram --target @mychat --message "Hi"',
    "telegram_send",
    "Send via your Telegram bot.",
  ],
] as const;

export function configureProgramHelp(program: Command, ctx: ProgramContext) {
  const formatExtraInfo = (labelKey: string, value: string) =>
    `${t(labelKey)}: ${value}`;
  const formatDefaultValue = (value: unknown) => JSON.stringify(value);

  program
    .name(CLI_NAME)
    .description("")
    .version(ctx.programVersion, "-V, --version", t("cli_help.root.options.version"))
    .option(
      "--container <name>",
      t("cli_help.root.options.container"),
    )
    .option(
      "--dev",
      t("cli_help.root.options.dev"),
    )
    .option(
      "--profile <name>",
      t("cli_help.root.options.profile"),
    )
    .option(
      "--log-level <level>",
      t("cli_help.root.options.log_level", { values: CLI_LOG_LEVEL_VALUES }),
      parseCliLogLevelOption,
    );

  program.option("--no-color", t("cli_help.root.options.no_color"), false);
  program.helpOption("-h, --help", t("cli_help.options.help"));
  program.helpCommand("help [command]", t("cli_help.options.help"));

  program.configureHelp({
    // sort options and subcommands alphabetically
    sortSubcommands: true,
    sortOptions: true,
    optionTerm: (option) => theme.option(option.flags),
    commandDescription: (cmd) => translateHelpText(cmd.description()),
    optionDescription: (option: Option) => {
      const extraInfo: string[] = [];
      if (option.argChoices) {
        extraInfo.push(
          formatExtraInfo(
            "cli_help.formatter.choices",
            option.argChoices.map((choice) => JSON.stringify(choice)).join(", "),
          ),
        );
      }
      if (option.defaultValue !== undefined) {
        const showDefault =
          option.required ||
          option.optional ||
          (option.isBoolean() && typeof option.defaultValue === "boolean");
        if (showDefault) {
          extraInfo.push(
            formatExtraInfo(
              "cli_help.formatter.default",
              option.defaultValueDescription || formatDefaultValue(option.defaultValue),
            ),
          );
        }
      }
      if (option.presetArg !== undefined && option.optional) {
        extraInfo.push(formatExtraInfo("cli_help.formatter.preset", formatDefaultValue(option.presetArg)));
      }
      if (option.envVar !== undefined) {
        extraInfo.push(formatExtraInfo("cli_help.formatter.env", option.envVar));
      }
      const description = translateHelpText(option.description);
      return extraInfo.length > 0
        ? `${description} (${extraInfo.join(", ")})`
        : description;
    },
    argumentDescription: (argument: Argument) => {
      const extraInfo: string[] = [];
      if (argument.argChoices) {
        extraInfo.push(
          formatExtraInfo(
            "cli_help.formatter.choices",
            argument.argChoices.map((choice) => JSON.stringify(choice)).join(", "),
          ),
        );
      }
      if (argument.defaultValue !== undefined) {
        extraInfo.push(
          formatExtraInfo(
            "cli_help.formatter.default",
            argument.defaultValueDescription || formatDefaultValue(argument.defaultValue),
          ),
        );
      }
      const description = translateHelpText(argument.description);
      if (extraInfo.length === 0) {
        return description;
      }
      const suffix = `(${extraInfo.join(", ")})`;
      return description ? `${description} ${suffix}` : suffix;
    },
    subcommandDescription: (cmd) => translateHelpText(cmd.description()),
    subcommandTerm: (cmd) => {
      const isRootCommand = cmd.parent === program;
      const hasSubcommands = isRootCommand && ROOT_COMMANDS_WITH_SUBCOMMANDS.has(cmd.name());
      return theme.command(hasSubcommands ? `${cmd.name()} *` : cmd.name());
    },
  });

  const formatHelpOutput = (str: string) => {
    let output = str;
    const isRootHelp = new RegExp(
      `^Usage:\\s+${CLI_NAME_PATTERN}\\s+\\[options\\]\\s+\\[command\\]\\s*$`,
      "m",
    ).test(output);
    if (isRootHelp && /^Commands:/m.test(output)) {
      output = output.replace(
        /^Commands:/m,
        `Commands:\n  ${theme.muted(t("cli_help.root.commands_hint"))}`,
      );
    }

    return output
      .replace(/^Usage:/gm, theme.heading(t("cli_help.labels.usage")))
      .replace(/^Options:/gm, theme.heading(t("cli_help.labels.options")))
      .replace(/^Commands:/gm, theme.heading(t("cli_help.labels.commands")))
      .replace(/^Examples:/gm, theme.heading(t("cli_help.labels.examples")))
      .replace(/^Docs:/gm, theme.heading(t("cli_help.labels.docs")))
      .replace(/^Arguments:/gm, theme.heading(t("cli_help.labels.arguments")))
      .replace(/^Global Options:/gm, theme.heading(t("cli_help.labels.global_options")));
  };

  program.configureOutput({
    writeOut: (str) => {
      process.stdout.write(formatHelpOutput(str));
    },
    writeErr: (str) => {
      process.stderr.write(formatHelpOutput(str));
    },
    outputError: (str, write) => write(theme.error(str)),
  });

  if (
    hasFlag(process.argv, "-V") ||
    hasFlag(process.argv, "--version") ||
    hasRootVersionAlias(process.argv)
  ) {
    const commit = resolveCommitHash({ moduleUrl: import.meta.url });
    console.log(
      commit ? `CoreBlow ${ctx.programVersion} (${commit})` : `CoreBlow ${ctx.programVersion}`,
    );
    process.exit(0);
  }

  program.addHelpText("beforeAll", () => {
    if (hasEmittedCliBanner()) {
      return "";
    }
    const rich = isRich();
    const line = formatCliBannerLine(ctx.programVersion, { richTty: rich });
    return `\n${line}\n`;
  });

  const fmtExamples = EXAMPLES.map(([cmd, key, fallback]) => {
    const translated = t(`cli_help.root.examples.${key}`);
    const desc = translated === `cli_help.root.examples.${key}` ? fallback : translated;
    return `  ${theme.command(replaceCliName(cmd, CLI_NAME))}\n    ${theme.muted(desc)}`;
  }).join("\n");

  program.addHelpText("afterAll", ({ command }) => {
    if (command !== program) {
      return "";
    }
    const docs = formatDocsLink("/cli", "docs.coreblow.com/cli");
    return `\n${theme.heading(t("cli_help.labels.examples"))}\n${fmtExamples}\n\n${theme.muted(t("cli_help.labels.docs"))} ${docs}\n`;
  });
}
