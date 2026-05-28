import type { ChannelPlugin } from "../channels/plugins/types.plugin.js";
import type { CoreBlowConfig } from "../config/config.js";
import type { createSubsystemLogger } from "../logging/subsystem.js";
import type { PluginRuntime } from "../plugins/runtime/types.js";
import { getChannelRuntimeContext, watchChannelRuntimeContexts } from "./channel-runtime-context.js";

export const CHANNEL_APPROVAL_NATIVE_RUNTIME_CONTEXT_CAPABILITY = "approval.native";

type ApprovalBootstrapHandler = {
  stop: () => Promise<void> | void;
};

type ApprovalRuntimeCapability = {
  startHandler?: (params: {
    cfg: CoreBlowConfig;
    accountId: string;
    context: unknown;
    channelRuntime: PluginRuntime["channel"];
  }) => Promise<ApprovalBootstrapHandler | null | undefined> | ApprovalBootstrapHandler | null | undefined;
};

function resolveNativeRuntimeCapability(
  plugin: Pick<ChannelPlugin, "approvalCapability">,
): ApprovalRuntimeCapability | null {
  const capability = plugin.approvalCapability?.nativeRuntime;
  if (!capability || typeof capability !== "object") {
    return null;
  }
  return capability as ApprovalRuntimeCapability;
}

export async function startChannelApprovalHandlerBootstrap(params: {
  plugin: Pick<ChannelPlugin, "id" | "meta" | "approvalCapability">;
  cfg: CoreBlowConfig;
  accountId: string;
  channelRuntime?: PluginRuntime["channel"];
  logger?: ReturnType<typeof createSubsystemLogger>;
}): Promise<() => Promise<void>> {
  const nativeRuntime = resolveNativeRuntimeCapability(params.plugin);
  if (!nativeRuntime || !params.channelRuntime) {
    return async () => {};
  }

  let activeHandler: ApprovalBootstrapHandler | null = null;

  const stopHandler = async () => {
    const handler = activeHandler;
    activeHandler = null;
    await handler?.stop();
  };

  const startHandlerForContext = async (context: unknown) => {
    await stopHandler();
    if (typeof nativeRuntime.startHandler !== "function") {
      return;
    }
    const handler = await nativeRuntime.startHandler({
      cfg: params.cfg,
      accountId: params.accountId,
      context,
      channelRuntime: params.channelRuntime!,
    });
    activeHandler = handler ?? null;
  };

  const spawn = (promise: Promise<void>) => {
    void promise.catch((error) => {
      params.logger?.error?.(
        `[${params.accountId}] native approval handler failed: ${String(error)}`,
      );
    });
  };

  const unsubscribe =
    watchChannelRuntimeContexts({
      channelRuntime: params.channelRuntime,
      channelId: params.plugin.id,
      accountId: params.accountId,
      capability: CHANNEL_APPROVAL_NATIVE_RUNTIME_CONTEXT_CAPABILITY,
      onEvent: (event) => {
        if (event.type === "registered") {
          spawn(startHandlerForContext(event.context));
          return;
        }
        spawn(stopHandler());
      },
    }) ?? (() => {});

  const existingContext = getChannelRuntimeContext({
    channelRuntime: params.channelRuntime,
    channelId: params.plugin.id,
    accountId: params.accountId,
    capability: CHANNEL_APPROVAL_NATIVE_RUNTIME_CONTEXT_CAPABILITY,
  });
  if (existingContext !== undefined) {
    spawn(startHandlerForContext(existingContext));
  }

  return async () => {
    unsubscribe();
    await stopHandler();
  };
}
