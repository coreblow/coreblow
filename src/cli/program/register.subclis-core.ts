import type { Command } from "commander";
import { getCommandPathWithRootOptions } from "../argv.js";
import { resolveCliArgvInvocation } from "../argv-invocation.js";
import { resolveCliCommandPathPolicy } from "../command-path-policy.js";
import {
  shouldEagerRegisterSubcommands,
  shouldRegisterPrimarySubcommandOnly,
} from "../command-registration-policy.js";
import {
  buildCommandGroupEntries,
  defineImportedProgramCommandGroupSpecs,
  type CommandGroupDescriptorSpec,
} from "./command-group-descriptors.js";
import { removeCommandByName } from "./command-tree.js";
import { loadPrivateQaCliModule } from "./private-qa-cli.js";
import {
  registerCommandGroupByName,
  registerCommandGroups,
  type CommandGroupEntry,
} from "./register-command-groups.js";
import {
  getSubCliCommandsWithSubcommands,
  getSubCliEntries as getSubCliEntryDescriptors,
  type SubCliDescriptor,
} from "./subcli-descriptors.js";

export { getSubCliCommandsWithSubcommands };

export type SubCliRegistrationContext = {
  purpose?: "runtime" | "completion";
};

type SubCliRegistrar = (
  program: Command,
  argv: string[],
  context: SubCliRegistrationContext,
) => Promise<void> | void;

function shouldRegisterGatewayRunOnly(name: string, argv: string[]): boolean {
  if (name !== "gateway") {
    return false;
  }
  const invocation = resolveCliArgvInvocation(argv);
  if (invocation.hasHelpOrVersion || invocation.commandPath[0] !== "gateway") {
    return false;
  }
  return invocation.commandPath.length === 1 || invocation.commandPath[1] === "run";
}

async function registerGatewayRunOnly(program: Command): Promise<void> {
  const { addGatewayRunCommand } = await import("../gateway-cli/run-command.js");
  removeCommandByName(program, "gateway");
  const gateway = addGatewayRunCommand(
    program.command("gateway").description("Run, inspect, and query the WebSocket Gateway"),
  );
  addGatewayRunCommand(
    gateway.command("run").description("Run the WebSocket Gateway (foreground)"),
  );
}

const PLUGINS_COMMANDS_WITHOUT_PLUGIN_CLI_PRELOAD = new Set([
  "install",
  "uninstall",
  "update",
  "verify",
  "policy",
]);

function shouldPreloadPluginCliForPluginsCommand(argv: string[]): boolean {
  const [, subcommand] = getCommandPathWithRootOptions(argv, 2);
  return !subcommand || !PLUGINS_COMMANDS_WITHOUT_PLUGIN_CLI_PRELOAD.has(subcommand);
}

const entrySpecs: readonly CommandGroupDescriptorSpec<SubCliRegistrar>[] = [
  ...defineImportedProgramCommandGroupSpecs([
    {
      commandNames: ["acp"],
      loadModule: () => import("../acp-cli.js"),
      exportName: "registerAcpCli",
    },
    {
      commandNames: ["gateway"],
      loadModule: () => import("../gateway-cli.js"),
      exportName: "registerGatewayCli",
    },
    {
      commandNames: ["daemon"],
      loadModule: () => import("../daemon-cli.js"),
      exportName: "registerDaemonCli",
    },
    {
      commandNames: ["logs"],
      loadModule: () => import("../logs-cli.js"),
      exportName: "registerLogsCli",
    },
    {
      commandNames: ["system"],
      loadModule: () => import("../system-cli.js"),
      exportName: "registerSystemCli",
    },
    {
      commandNames: ["models"],
      loadModule: () => import("../models-cli.js"),
      exportName: "registerModelsCli",
    },
    {
      commandNames: ["approvals"],
      loadModule: () => import("../exec-approvals-cli.js"),
      exportName: "registerExecApprovalsCli",
    },
    {
      commandNames: ["nodes"],
      loadModule: () => import("../nodes-cli.js"),
      exportName: "registerNodesCli",
    },
    {
      commandNames: ["devices"],
      loadModule: () => import("../devices-cli.js"),
      exportName: "registerDevicesCli",
    },
    {
      commandNames: ["node"],
      loadModule: () => import("../node-cli.js"),
      exportName: "registerNodeCli",
    },
    {
      commandNames: ["sandbox"],
      loadModule: () => import("../sandbox-cli.js"),
      exportName: "registerSandboxCli",
    },
    {
      commandNames: ["tui", "terminal", "chat"],
      loadModule: () => import("../tui-cli.js"),
      exportName: "registerTuiCli",
    },
    {
      commandNames: ["desktop"],
      loadModule: () => import("../desktop-cli.js"),
      exportName: "registerDesktopCli",
    },
    {
      commandNames: ["auth"],
      loadModule: () => import("../commands/auth-cmd.js"),
      exportName: "registerAuthCommand",
    },
    {
      commandNames: ["cron"],
      loadModule: () => import("../cron-cli.js"),
      exportName: "registerCronCli",
    },
    {
      commandNames: ["dns"],
      loadModule: () => import("../dns-cli.js"),
      exportName: "registerDnsCli",
    },
    {
      commandNames: ["docs"],
      loadModule: () => import("../docs-cli.js"),
      exportName: "registerDocsCli",
    },
    {
      commandNames: ["qa"],
      loadModule: loadPrivateQaCliModule,
      exportName: "registerQaLabCli",
    },
    {
      commandNames: ["hooks"],
      loadModule: () => import("../hooks-cli.js"),
      exportName: "registerHooksCli",
    },
    {
      commandNames: ["webhooks"],
      loadModule: () => import("../webhooks-cli.js"),
      exportName: "registerWebhooksCli",
    },
    {
      commandNames: ["qr"],
      loadModule: () => import("../qr-cli.js"),
      exportName: "registerQrCli",
    },
    {
      commandNames: ["corebot"],
      loadModule: () => import("../corebot-cli.js"),
      exportName: "registerCorebotCli",
    },
  ]),
  {
    commandNames: ["pairing"],
    register: async (program, argv) => {
      const { registerPluginCliCommands } = await import("../../plugins/cli.js");
      const { loadValidatedConfigForPluginRegistration } = await import("./register.subclis.js");
      const config = await loadValidatedConfigForPluginRegistration();
      if (config) {
        registerPluginCliCommands(program, config);
      }
      const mod = await import("../pairing-cli.js");
      mod.registerPairingCli(program);
    },
  },
  {
    commandNames: ["plugins"],
    register: async (program, argv) => {
      const mod = await import("../plugins-cli.js");
      mod.registerPluginsCli(program);
      if (!shouldPreloadPluginCliForPluginsCommand(argv)) {
        return;
      }
      const { registerPluginCliCommands } = await import("../../plugins/cli.js");
      const { loadValidatedConfigForPluginRegistration } = await import("./register.subclis.js");
      const config = await loadValidatedConfigForPluginRegistration();
      if (config) {
        registerPluginCliCommands(program, config);
      }
    },
  },
  {
    commandNames: ["channels"],
    register: async (program) => {
      const mod = await import("../channels-cli.js");
      await mod.registerChannelsCli(program);
    },
  },
  ...defineImportedProgramCommandGroupSpecs([
    {
      commandNames: ["directory"],
      loadModule: () => import("../directory-cli.js"),
      exportName: "registerDirectoryCli",
    },
    {
      commandNames: ["security"],
      loadModule: () => import("../security-cli.js"),
      exportName: "registerSecurityCli",
    },
    {
      commandNames: ["secrets"],
      loadModule: () => import("../secrets-cli.js"),
      exportName: "registerSecretsCli",
    },
    {
      commandNames: ["skills"],
      loadModule: () => import("../skills-cli.js"),
      exportName: "registerSkillsCli",
    },
    {
      commandNames: ["update"],
      loadModule: () => import("../update-cli.js"),
      exportName: "registerUpdateCli",
    },
  ]),
];

function resolveSubCliCommandGroups(
  argv: string[],
  context: SubCliRegistrationContext = {},
): CommandGroupEntry[] {
  const descriptors = getSubCliEntryDescriptors();
  const descriptorNames = new Set(descriptors.map((descriptor) => descriptor.name));
  return buildCommandGroupEntries(
    descriptors,
    entrySpecs.filter((spec) => spec.commandNames.every((name) => descriptorNames.has(name))),
    (register) => async (program) => {
      await register(program, argv, context);
    },
  );
}

export function getSubCliEntries(): ReadonlyArray<SubCliDescriptor> {
  return getSubCliEntryDescriptors();
}

export async function registerSubCliByName(
  program: Command,
  name: string,
  argv: string[] = process.argv,
  context: SubCliRegistrationContext = {},
): Promise<boolean> {
  if (shouldRegisterGatewayRunOnly(name, argv)) {
    await registerGatewayRunOnly(program);
    return true;
  }
  return registerCommandGroupByName(program, resolveSubCliCommandGroups(argv, context), name);
}

export function registerSubCliCommands(program: Command, argv: string[] = process.argv) {
  const { primary } = resolveCliArgvInvocation(argv);
  registerCommandGroups(program, resolveSubCliCommandGroups(argv), {
    eager: shouldEagerRegisterSubcommands(),
    primary,
    registerPrimaryOnly: Boolean(primary && shouldRegisterPrimarySubcommandOnly(argv)),
  });
}
