import {
  type Command,
  type Modal,
  type TopLevelComponents,
} from "@buape/carbon";
import { CHANNEL_APPROVAL_NATIVE_RUNTIME_CONTEXT_CAPABILITY } from "coreblow/plugin-sdk/approval-handler-adapter-runtime";
import type { ChannelRuntimeSurface } from "coreblow/plugin-sdk/channel-contract";
import { registerChannelRuntimeContext } from "coreblow/plugin-sdk/channel-runtime-context";
import type { NativeCommandSpec } from "coreblow/plugin-sdk/command-auth-native";
import type { DiscordAccountConfig, CoreBlowConfig } from "coreblow/plugin-sdk/config-runtime";
import type { RuntimeEnv } from "coreblow/plugin-sdk/runtime-env";
import { isDiscordExecApprovalClientEnabled } from "../exec-approvals.js";
import { createDiscordVoiceCommand } from "../voice/command.js";
import {
  createAgentComponentControls,
  createDiscordComponentControls,
  createDiscordComponentModal,
} from "./agent-components.js";
import {
  createDiscordExecApprovalButtonContext,
  createExecApprovalButton,
} from "./exec-approvals.js";
import {
  createDiscordCommandArgFallbackButton,
  createDiscordModelPickerFallbackButton,
  createDiscordModelPickerFallbackSelect,
  createDiscordNativeCommand,
} from "./native-command.js";
import type { ThreadBindingManager } from "./thread-bindings.types.js";

type DiscordVoiceManager = import("../voice/manager.js").DiscordVoiceManager;

export function createDiscordProviderInteractionSurface(params: {
  cfg: CoreBlowConfig;
  discordConfig: DiscordAccountConfig;
  accountId: string;
  token: string;
  commandSpecs: NativeCommandSpec[];
  nativeEnabled: boolean;
  voiceEnabled: boolean;
  groupPolicy: "open" | "disabled" | "allowlist";
  useAccessGroups: boolean;
  sessionPrefix: string;
  ephemeralDefault: boolean;
  threadBindings: ThreadBindingManager;
  voiceManagerRef: { current: DiscordVoiceManager | null };
  guildEntries: DiscordAccountConfig["guilds"];
  allowFrom: DiscordAccountConfig["allowFrom"];
  dmPolicy: NonNullable<DiscordAccountConfig["dmPolicy"]>;
  runtime: RuntimeEnv;
  channelRuntime?: ChannelRuntimeSurface;
  abortSignal?: AbortSignal;
  createNativeCommand?: typeof createDiscordNativeCommand;
}): {
  commands: Command[];
  components: TopLevelComponents[];
  modals: Modal[];
} {
  const createNativeCommand = params.createNativeCommand ?? createDiscordNativeCommand;
  const commands: Command[] = params.commandSpecs.map((spec) =>
    createNativeCommand({
      command: spec,
      cfg: params.cfg,
      discordConfig: params.discordConfig,
      accountId: params.accountId,
      sessionPrefix: params.sessionPrefix,
      ephemeralDefault: params.ephemeralDefault,
      threadBindings: params.threadBindings,
    }),
  );
  if (params.nativeEnabled && params.voiceEnabled) {
    commands.push(
      createDiscordVoiceCommand({
        cfg: params.cfg,
        discordConfig: params.discordConfig,
        accountId: params.accountId,
        groupPolicy: params.groupPolicy,
        useAccessGroups: params.useAccessGroups,
        getManager: () => params.voiceManagerRef.current,
        ephemeralDefault: params.ephemeralDefault,
      }),
    );
  }

  const execApprovalsConfig = params.discordConfig.execApprovals ?? {};
  const execApprovalsEnabled = isDiscordExecApprovalClientEnabled({
    cfg: params.cfg,
    accountId: params.accountId,
  });
  if (execApprovalsEnabled) {
    registerChannelRuntimeContext({
      channelRuntime: params.channelRuntime,
      channelId: "discord",
      accountId: params.accountId,
      capability: CHANNEL_APPROVAL_NATIVE_RUNTIME_CONTEXT_CAPABILITY,
      context: {
        token: params.token,
        config: execApprovalsConfig,
      },
      abortSignal: params.abortSignal,
    });
  }

  const components: TopLevelComponents[] = [
    createDiscordCommandArgFallbackButton({
      cfg: params.cfg,
      discordConfig: params.discordConfig,
      accountId: params.accountId,
      sessionPrefix: params.sessionPrefix,
      threadBindings: params.threadBindings,
    }),
    createDiscordModelPickerFallbackButton({
      cfg: params.cfg,
      discordConfig: params.discordConfig,
      accountId: params.accountId,
      sessionPrefix: params.sessionPrefix,
      threadBindings: params.threadBindings,
    }),
    createDiscordModelPickerFallbackSelect({
      cfg: params.cfg,
      discordConfig: params.discordConfig,
      accountId: params.accountId,
      sessionPrefix: params.sessionPrefix,
      threadBindings: params.threadBindings,
    }),
  ];
  const modals: Modal[] = [];

  if (execApprovalsEnabled) {
    components.push(
      createExecApprovalButton(
        createDiscordExecApprovalButtonContext({
          cfg: params.cfg,
          accountId: params.accountId,
          config: execApprovalsConfig,
          token: params.token,
        }),
      ),
    );
  }

  const agentComponentsConfig = params.discordConfig.agentComponents ?? {};
  if (agentComponentsConfig.enabled ?? true) {
    const componentContext = {
      cfg: params.cfg,
      discordConfig: params.discordConfig,
      accountId: params.accountId,
      guildEntries: params.guildEntries,
      allowFrom: params.allowFrom,
      dmPolicy: params.dmPolicy,
      runtime: params.runtime,
      token: params.token,
    };
    components.push(...createAgentComponentControls.map((create) => create(componentContext)));
    components.push(...createDiscordComponentControls.map((create) => create(componentContext)));
    modals.push(createDiscordComponentModal(componentContext));
  }

  return { commands, components, modals };
}
