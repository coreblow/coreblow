import type {
  AcpRuntime,
  CoreBlowPluginService,
  CoreBlowPluginServiceContext,
  PluginLogger,
} from "../runtime-api.js";
import { registerAcpRuntimeBackend, unregisterAcpRuntimeBackend } from "../runtime-api.js";
import { resolveAcpPluginConfig, type ResolvedAcpPluginConfig } from "./config.js";
import { ensureAcp } from "./ensure.js";
import { ACP_BACKEND_ID, AcpCliRuntime } from "./runtime.js";

type AcpRuntimeLike = AcpRuntime & {
  probeAvailability(): Promise<void>;
  isHealthy(): boolean;
};

type AcpRuntimeFactoryParams = {
  pluginConfig: ResolvedAcpPluginConfig;
  queueOwnerTtlSeconds: number;
  logger?: PluginLogger;
};

type CreateAcpRuntimeServiceParams = {
  pluginConfig?: unknown;
  runtimeFactory?: (params: AcpRuntimeFactoryParams) => AcpRuntimeLike;
};

function createDefaultRuntime(params: AcpRuntimeFactoryParams): AcpRuntimeLike {
  return new AcpCliRuntime(params.pluginConfig, {
    logger: params.logger,
    queueOwnerTtlSeconds: params.queueOwnerTtlSeconds,
  });
}

export function createAcpRuntimeService(
  params: CreateAcpRuntimeServiceParams = {},
): CoreBlowPluginService {
  let runtime: AcpRuntimeLike | null = null;
  let lifecycleRevision = 0;

  return {
    id: "acp-runtime",
    async start(ctx: CoreBlowPluginServiceContext): Promise<void> {
      const pluginConfig = resolveAcpPluginConfig({
        rawConfig: params.pluginConfig,
        workspaceDir: ctx.workspaceDir,
      });
      const runtimeFactory = params.runtimeFactory ?? createDefaultRuntime;
      runtime = runtimeFactory({
        pluginConfig,
        queueOwnerTtlSeconds: pluginConfig.queueOwnerTtlSeconds,
        logger: ctx.logger,
      });

      registerAcpRuntimeBackend({
        id: ACP_BACKEND_ID,
        runtime,
        healthy: () => runtime?.isHealthy() ?? false,
      });
      const expectedVersionLabel = pluginConfig.expectedVersion ?? "any";
      const installLabel = pluginConfig.allowPluginLocalInstall ? "enabled" : "disabled";
      ctx.logger.info(
        `ACP runtime backend registered (acp command: ${pluginConfig.command}, expectedVersion: ${expectedVersionLabel}, pluginLocalInstall: ${installLabel})`,
      );

      lifecycleRevision += 1;
      const currentRevision = lifecycleRevision;
      void (async () => {
        try {
          await ensureAcp({
            command: pluginConfig.command,
            logger: ctx.logger,
            expectedVersion: pluginConfig.expectedVersion,
            allowInstall: pluginConfig.allowPluginLocalInstall,
            stripProviderAuthEnvVars: pluginConfig.stripProviderAuthEnvVars,
            spawnOptions: {
              strictWindowsCmdWrapper: pluginConfig.strictWindowsCmdWrapper,
            },
          });
          if (currentRevision !== lifecycleRevision) {
            return;
          }
          await runtime?.probeAvailability();
          if (runtime?.isHealthy()) {
            ctx.logger.info("ACP runtime backend ready");
          } else {
            ctx.logger.warn("ACP runtime backend probe failed after local acp install");
          }
        } catch (err) {
          if (currentRevision !== lifecycleRevision) {
            return;
          }
          ctx.logger.warn(
            `ACP runtime setup failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      })();
    },
    async stop(_ctx: CoreBlowPluginServiceContext): Promise<void> {
      lifecycleRevision += 1;
      unregisterAcpRuntimeBackend(ACP_BACKEND_ID);
      runtime = null;
    },
  };
}
