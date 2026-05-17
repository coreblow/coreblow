import type { Command } from "commander";
import {
  modelsAliasesAddCommand,
  modelsAliasesListCommand,
  modelsAliasesRemoveCommand,
  modelsAuthAddCommand,
  modelsAuthLoginCommand,
  modelsAuthOrderClearCommand,
  modelsAuthOrderGetCommand,
  modelsAuthOrderSetCommand,
  modelsAuthPasteTokenCommand,
  modelsAuthSetupTokenCommand,
  modelsFallbacksAddCommand,
  modelsFallbacksClearCommand,
  modelsFallbacksListCommand,
  modelsFallbacksRemoveCommand,
  modelsImageFallbacksAddCommand,
  modelsImageFallbacksClearCommand,
  modelsImageFallbacksListCommand,
  modelsImageFallbacksRemoveCommand,
  modelsListCommand,
  modelsScanCommand,
  modelsSetCommand,
  modelsSetImageCommand,
  modelsStatusCommand,
} from "../commands/models.js";
import { t } from "../infra/i18n/index.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { resolveOptionFromCommand, runCommandWithRuntime } from "./cli-utils.js";

function runModelsCommand(action: () => Promise<void>) {
  return runCommandWithRuntime(defaultRuntime, action);
}

export function registerModelsCli(program: Command) {
  const models = program
    .command("models")
    .description(t("cli_help.models.description"))
    .option("--status-json", t("cli_help.models.options.status_json"), false)
    .option("--status-plain", t("cli_help.models.options.status_plain"), false)
    .option(
      "--agent <id>",
      t("cli_help.models.options.agent"),
    )
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted(t("cli_help.labels.docs"))} ${formatDocsLink("/cli/models", "docs.coreblow.com/cli/models")}\n`,
    );

  models
    .command("list")
    .description(t("cli_help.models.commands.list"))
    .option("--all", t("cli_help.models.options.all"), false)
    .option("--local", t("cli_help.models.options.local"), false)
    .option("--provider <name>", t("cli_help.models.options.provider_filter"))
    .option("--json", t("cli_help.options.json_text"), false)
    .option("--plain", t("cli_help.models.options.plain_line"), false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await modelsListCommand(opts, defaultRuntime);
      });
    });

  models
    .command("status")
    .description(t("cli_help.models.commands.status"))
    .option("--json", t("cli_help.options.json_text"), false)
    .option("--plain", t("cli_help.models.options.plain"), false)
    .option(
      "--check",
      t("cli_help.models.options.check"),
      false,
    )
    .option("--probe", t("cli_help.models.options.probe"), false)
    .option("--probe-provider <name>", t("cli_help.models.options.probe_provider"))
    .option(
      "--probe-profile <id>",
      t("cli_help.models.options.probe_profile"),
      (value, previous) => {
        const next = Array.isArray(previous) ? previous : previous ? [previous] : [];
        next.push(value);
        return next;
      },
    )
    .option("--probe-timeout <ms>", t("cli_help.models.options.probe_timeout"))
    .option("--probe-concurrency <n>", t("cli_help.models.options.probe_concurrency"))
    .option("--probe-max-tokens <n>", t("cli_help.models.options.probe_max_output"))
    .option(
      "--agent <id>",
      t("cli_help.models.options.agent"),
    )
    .action(async (opts, command) => {
      const agent =
        resolveOptionFromCommand<string>(command, "agent") ?? (opts.agent as string | undefined);
      await runModelsCommand(async () => {
        await modelsStatusCommand(
          {
            json: Boolean(opts.json),
            plain: Boolean(opts.plain),
            check: Boolean(opts.check),
            probe: Boolean(opts.probe),
            probeProvider: opts.probeProvider as string | undefined,
            probeProfile: opts.probeProfile as string | string[] | undefined,
            probeTimeout: opts.probeTimeout as string | undefined,
            probeConcurrency: opts.probeConcurrency as string | undefined,
            probeMaxTokens: opts.probeMaxTokens as string | undefined,
            agent,
          },
          defaultRuntime,
        );
      });
    });

  models
    .command("set")
    .description(t("cli_help.models.commands.set"))
    .argument("<model>", t("cli_help.models.arguments.model"))
    .action(async (model: string) => {
      await runModelsCommand(async () => {
        await modelsSetCommand(model, defaultRuntime);
      });
    });

  models
    .command("set-image")
    .description(t("cli_help.models.commands.set_image"))
    .argument("<model>", t("cli_help.models.arguments.model"))
    .action(async (model: string) => {
      await runModelsCommand(async () => {
        await modelsSetImageCommand(model, defaultRuntime);
      });
    });

  const aliases = models.command("aliases").description(t("cli_help.models.commands.aliases"));

  aliases
    .command("list")
    .description(t("cli_help.models.commands.aliases_list"))
    .option("--json", t("cli_help.options.json_text"), false)
    .option("--plain", t("cli_help.models.options.plain"), false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await modelsAliasesListCommand(opts, defaultRuntime);
      });
    });

  aliases
    .command("add")
    .description(t("cli_help.models.commands.aliases_add"))
    .argument("<alias>", t("cli_help.models.arguments.alias"))
    .argument("<model>", t("cli_help.models.arguments.model"))
    .action(async (alias: string, model: string) => {
      await runModelsCommand(async () => {
        await modelsAliasesAddCommand(alias, model, defaultRuntime);
      });
    });

  aliases
    .command("remove")
    .description(t("cli_help.models.commands.aliases_remove"))
    .argument("<alias>", t("cli_help.models.arguments.alias"))
    .action(async (alias: string) => {
      await runModelsCommand(async () => {
        await modelsAliasesRemoveCommand(alias, defaultRuntime);
      });
    });

  const fallbacks = models.command("fallbacks").description(t("cli_help.models.commands.fallbacks"));

  fallbacks
    .command("list")
    .description(t("cli_help.models.commands.fallbacks_list"))
    .option("--json", t("cli_help.options.json_text"), false)
    .option("--plain", t("cli_help.models.options.plain"), false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await modelsFallbacksListCommand(opts, defaultRuntime);
      });
    });

  fallbacks
    .command("add")
    .description(t("cli_help.models.commands.fallbacks_add"))
    .argument("<model>", t("cli_help.models.arguments.model"))
    .action(async (model: string) => {
      await runModelsCommand(async () => {
        await modelsFallbacksAddCommand(model, defaultRuntime);
      });
    });

  fallbacks
    .command("remove")
    .description(t("cli_help.models.commands.fallbacks_remove"))
    .argument("<model>", t("cli_help.models.arguments.model"))
    .action(async (model: string) => {
      await runModelsCommand(async () => {
        await modelsFallbacksRemoveCommand(model, defaultRuntime);
      });
    });

  fallbacks
    .command("clear")
    .description(t("cli_help.models.commands.fallbacks_clear"))
    .action(async () => {
      await runModelsCommand(async () => {
        await modelsFallbacksClearCommand(defaultRuntime);
      });
    });

  const imageFallbacks = models
    .command("image-fallbacks")
    .description(t("cli_help.models.commands.image_fallbacks"));

  imageFallbacks
    .command("list")
    .description(t("cli_help.models.commands.image_fallbacks_list"))
    .option("--json", t("cli_help.options.json_text"), false)
    .option("--plain", t("cli_help.models.options.plain"), false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await modelsImageFallbacksListCommand(opts, defaultRuntime);
      });
    });

  imageFallbacks
    .command("add")
    .description(t("cli_help.models.commands.image_fallbacks_add"))
    .argument("<model>", t("cli_help.models.arguments.model"))
    .action(async (model: string) => {
      await runModelsCommand(async () => {
        await modelsImageFallbacksAddCommand(model, defaultRuntime);
      });
    });

  imageFallbacks
    .command("remove")
    .description(t("cli_help.models.commands.image_fallbacks_remove"))
    .argument("<model>", t("cli_help.models.arguments.model"))
    .action(async (model: string) => {
      await runModelsCommand(async () => {
        await modelsImageFallbacksRemoveCommand(model, defaultRuntime);
      });
    });

  imageFallbacks
    .command("clear")
    .description(t("cli_help.models.commands.image_fallbacks_clear"))
    .action(async () => {
      await runModelsCommand(async () => {
        await modelsImageFallbacksClearCommand(defaultRuntime);
      });
    });

  models
    .command("scan")
    .description(t("cli_help.models.commands.scan"))
    .option("--min-params <b>", t("cli_help.models.options.min_params"))
    .option("--max-age-days <days>", t("cli_help.models.options.max_age_days"))
    .option("--provider <name>", t("cli_help.models.options.provider_prefix"))
    .option("--max-candidates <n>", t("cli_help.models.options.max_candidates"), "6")
    .option("--timeout <ms>", t("cli_help.models.options.probe_timeout"))
    .option("--concurrency <n>", t("cli_help.models.options.probe_concurrency"))
    .option("--no-probe", t("cli_help.models.options.no_probe"))
    .option("--yes", t("cli_help.models.options.yes"), false)
    .option("--no-input", t("cli_help.models.options.no_input"))
    .option("--set-default", t("cli_help.models.options.set_default"), false)
    .option("--set-image", t("cli_help.models.options.set_image"), false)
    .option("--json", t("cli_help.options.json_text"), false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await modelsScanCommand(opts, defaultRuntime);
      });
    });

  models.action(async (opts) => {
    await runModelsCommand(async () => {
      await modelsStatusCommand(
        {
          json: Boolean(opts?.statusJson),
          plain: Boolean(opts?.statusPlain),
          agent: opts?.agent as string | undefined,
        },
        defaultRuntime,
      );
    });
  });

  const auth = models.command("auth").description(t("cli_help.models.auth.description"));
  auth.option("--agent <id>", t("cli_help.models.auth.options.agent"));
  auth.action(() => {
    auth.help();
  });

  auth
    .command("add")
    .description(t("cli_help.models.auth.commands.add"))
    .action(async () => {
      await runModelsCommand(async () => {
        await modelsAuthAddCommand({}, defaultRuntime);
      });
    });

  auth
    .command("login")
    .description(t("cli_help.models.auth.commands.login"))
    .option("--provider <id>", t("cli_help.models.auth.options.provider_registered"))
    .option("--method <id>", t("cli_help.models.auth.options.method"))
    .option("--set-default", t("cli_help.models.auth.options.set_default"), false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await modelsAuthLoginCommand(
          {
            provider: opts.provider as string | undefined,
            method: opts.method as string | undefined,
            setDefault: Boolean(opts.setDefault),
          },
          defaultRuntime,
        );
      });
    });

  auth
    .command("setup-token")
    .description(t("cli_help.models.auth.commands.setup_credential"))
    .option("--provider <name>", t("cli_help.models.auth.options.provider_default"))
    .option("--yes", t("cli_help.models.options.yes"), false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await modelsAuthSetupTokenCommand(
          {
            provider: opts.provider as string | undefined,
            yes: Boolean(opts.yes),
          },
          defaultRuntime,
        );
      });
    });

  auth
    .command("paste-token")
    .description(t("cli_help.models.auth.commands.paste_credential"))
    .requiredOption("--provider <name>", t("cli_help.models.auth.options.provider_example"))
    .option("--profile-id <id>", t("cli_help.models.auth.options.profile_id"))
    .option(
      "--expires-in <duration>",
      t("cli_help.models.auth.options.expires_in"),
    )
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await modelsAuthPasteTokenCommand(
          {
            provider: opts.provider as string | undefined,
            profileId: opts.profileId as string | undefined,
            expiresIn: opts.expiresIn as string | undefined,
          },
          defaultRuntime,
        );
      });
    });

  auth
    .command("login-github-copilot")
    .description(t("cli_help.models.auth.commands.login_github_copilot"))
    .option("--yes", t("cli_help.models.auth.options.overwrite_yes"), false)
    .action(async (opts) => {
      await runModelsCommand(async () => {
        await modelsAuthLoginCommand(
          {
            provider: "github-copilot",
            method: "device",
            yes: Boolean(opts.yes),
          },
          defaultRuntime,
        );
      });
    });

  const order = auth.command("order").description(t("cli_help.models.auth.order.description"));

  order
    .command("get")
    .description(t("cli_help.models.auth.order.commands.get"))
    .requiredOption("--provider <name>", t("cli_help.models.auth.options.provider_example"))
    .option("--agent <id>", t("cli_help.models.auth.options.agent_default"))
    .option("--json", t("cli_help.options.json_text"), false)
    .action(async (opts, command) => {
      const agent =
        resolveOptionFromCommand<string>(command, "agent") ?? (opts.agent as string | undefined);
      await runModelsCommand(async () => {
        await modelsAuthOrderGetCommand(
          {
            provider: opts.provider as string,
            agent,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  order
    .command("set")
    .description(t("cli_help.models.auth.order.commands.set"))
    .requiredOption("--provider <name>", t("cli_help.models.auth.options.provider_example"))
    .option("--agent <id>", t("cli_help.models.auth.options.agent_default"))
    .argument("<profileIds...>", t("cli_help.models.auth.arguments.profile_ids"))
    .action(async (profileIds: string[], opts, command) => {
      const agent =
        resolveOptionFromCommand<string>(command, "agent") ?? (opts.agent as string | undefined);
      await runModelsCommand(async () => {
        await modelsAuthOrderSetCommand(
          {
            provider: opts.provider as string,
            agent,
            order: profileIds,
          },
          defaultRuntime,
        );
      });
    });

  order
    .command("clear")
    .description(t("cli_help.models.auth.order.commands.clear"))
    .requiredOption("--provider <name>", t("cli_help.models.auth.options.provider_example"))
    .option("--agent <id>", t("cli_help.models.auth.options.agent_default"))
    .action(async (opts, command) => {
      const agent =
        resolveOptionFromCommand<string>(command, "agent") ?? (opts.agent as string | undefined);
      await runModelsCommand(async () => {
        await modelsAuthOrderClearCommand(
          {
            provider: opts.provider as string,
            agent,
          },
          defaultRuntime,
        );
      });
    });
}
