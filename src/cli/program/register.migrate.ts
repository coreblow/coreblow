import type { Command } from "commander";
import { defaultRuntime } from "../../runtime.js";
import { theme } from "../../terminal/theme.js";
import { runCommandWithRuntime } from "../cli-utils.js";
import { formatHelpExamples } from "../help-format.js";

function collectMigrationSkill(value: string, previous: string[] | undefined): string[] {
  return [...(previous ?? []), value];
}

function collectMigrationPlugin(value: string, previous: string[] | undefined): string[] {
  return [...(previous ?? []), value];
}

function readMigrationSkills(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const skills = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return skills.length > 0 ? skills : undefined;
}

function readMigrationPlugins(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const plugins = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return plugins.length > 0 ? plugins : undefined;
}

function addMigrationSkillOption(command: Command): Command {
  return command.option(
    "--skill <name>",
    "Select one skill to migrate by name or item id; repeat for multiple skills",
    collectMigrationSkill,
  );
}

function addMigrationPluginOption(command: Command): Command {
  return command.option(
    "--plugin <name>",
    "Select one Codex plugin to migrate by name or item id; repeat for multiple plugins",
    collectMigrationPlugin,
  );
}

function addVerifyPluginAppsOption(command: Command): Command {
  return command.option(
    "--verify-plugin-apps",
    "Codex only: verify source plugin app accessibility with app/list before planning native plugin activation",
    false,
  );
}

function addMigrationOptions(command: Command): Command {
  return addVerifyPluginAppsOption(
    addMigrationPluginOption(
      addMigrationSkillOption(
        command
          .option("--from <path>", "Source directory to migrate from")
          .option("--include-secrets", "Import supported credentials and secrets", false)
          .option(
            "--overwrite",
            "Overwrite conflicting target files after item-level backups",
            false,
          )
          .option("--json", "Output JSON", false),
      ),
    ),
  );
}

function readVerifyPluginApps(value: unknown): boolean {
  return value === true;
}

export function registerMigrateCommand(program: Command) {
  const migrate = addVerifyPluginAppsOption(
    program
      .command("migrate")
      .description("Import state from another agent system")
      .argument("[provider]", "Migration provider id, for example hermes")
      .option("--from <path>", "Source directory to migrate from")
      .option("--include-secrets", "Import supported credentials and secrets", false)
      .option("--overwrite", "Overwrite conflicting target files after item-level backups", false)
      .option("--dry-run", "Preview only; do not apply changes", false)
      .option("--yes", "Apply without prompting after preview", false)
      .option(
        "--skill <name>",
        "Select one skill to migrate by name or item id; repeat for multiple skills",
        collectMigrationSkill,
      )
      .option(
        "--plugin <name>",
        "Select one Codex plugin to migrate by name or item id; repeat for multiple plugins",
        collectMigrationPlugin,
      )
      .option("--backup-output <path>", "Pre-migration backup archive path or directory")
      .option("--no-backup", "Skip the pre-migration CoreBlow backup")
      .option("--force", "Allow dangerous options such as --no-backup", false)
      .option("--json", "Output JSON", false),
  )
    .addHelpText(
      "after",
      () =>
        `\n${theme.heading("Examples:")}\n${formatHelpExamples([
          ["coreblow migrate list", "Show available migration providers."],
          ["coreblow migrate hermes", "Preview Hermes migration, then prompt before applying."],
          [
            "coreblow migrate hermes --dry-run",
            "Preview Hermes migration plan without writing changes.",
          ],
          ["coreblow migrate hermes --yes", "Apply Hermes migration without interactive prompts."],
          [
            "coreblow migrate claude --include-secrets",
            "Import Claude skills and supported credentials.",
          ],
          [
            "coreblow migrate codex --from /custom/codex/path",
            "Migrate from an alternate Codex source directory.",
          ],
        ])}`,
    )
    .action(async (provider: string | undefined, opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        const { migrateDefaultCommand } = await import("../../commands/migrate.js");
        await migrateDefaultCommand(
          defaultRuntime,
          {
            provider,
            source: opts.from as string | undefined,
            includeSecrets: Boolean(opts.includeSecrets),
            overwrite: Boolean(opts.overwrite),
            dryRun: Boolean(opts.dryRun),
            yes: Boolean(opts.yes),
            skills: readMigrationSkills(opts.skill),
            plugins: readMigrationPlugins(opts.plugin),
            backupOutput: opts.backupOutput as string | undefined,
            noBackup: Boolean(opts.noBackup),
            force: Boolean(opts.force),
            verifyPluginApps: readVerifyPluginApps(opts.verifyPluginApps),
            json: Boolean(opts.json),
          },
        );
      });
    });

  migrate
    .command("list")
    .description("List available migration providers")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        const { migrateListCommand } = await import("../../commands/migrate.js");
        await migrateListCommand(defaultRuntime, { json: Boolean(opts.json) });
      });
    });

  addMigrationOptions(
    migrate
      .command("plan <provider>")
      .description("Inspect migration dry-run plan without writing changes"),
  ).action(async (provider: string, opts) => {
    await runCommandWithRuntime(defaultRuntime, async () => {
      const { migratePlanCommand } = await import("../../commands/migrate.js");
      await migratePlanCommand(
        defaultRuntime,
        {
          provider,
          source: opts.from as string | undefined,
          includeSecrets: Boolean(opts.includeSecrets),
          overwrite: Boolean(opts.overwrite),
          skills: readMigrationSkills(opts.skill),
          plugins: readMigrationPlugins(opts.plugin),
          verifyPluginApps: readVerifyPluginApps(opts.verifyPluginApps),
          json: Boolean(opts.json),
        },
      );
    });
  });

  addMigrationOptions(
    migrate
      .command("apply <provider>")
      .description("Apply migration changes")
      .option("--yes", "Apply without interactive confirmation", false)
      .option("--backup-output <path>", "Pre-migration backup archive path or directory")
      .option("--no-backup", "Skip the pre-migration CoreBlow backup")
      .option("--force", "Allow dangerous options such as --no-backup", false),
  ).action(async (provider: string, opts) => {
    await runCommandWithRuntime(defaultRuntime, async () => {
      const { migrateApplyCommand } = await import("../../commands/migrate.js");
      await migrateApplyCommand(
        defaultRuntime,
        {
          provider,
          source: opts.from as string | undefined,
          includeSecrets: Boolean(opts.includeSecrets),
          overwrite: Boolean(opts.overwrite),
          yes: Boolean(opts.yes),
          skills: readMigrationSkills(opts.skill),
          plugins: readMigrationPlugins(opts.plugin),
          backupOutput: opts.backupOutput as string | undefined,
          noBackup: Boolean(opts.noBackup),
          force: Boolean(opts.force),
          verifyPluginApps: readVerifyPluginApps(opts.verifyPluginApps),
          json: Boolean(opts.json),
        },
      );
    });
  });
}
