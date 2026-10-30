import type { ChannelPlugin } from "coreblow/plugin-sdk/channel-core";
import { createLazyRuntimeNamedExport } from "coreblow/plugin-sdk/lazy-runtime";
import type { ResolvedMatrixAccount } from "./matrix/accounts.js";

const loadMatrixChannelRuntime = createLazyRuntimeNamedExport(
  () => import("./resolver.runtime.js"),
  "matrixResolverRuntime",
);

type MatrixResolver = NonNullable<ChannelPlugin<ResolvedMatrixAccount>["resolver"]>;

export const matrixResolverAdapter: MatrixResolver = {
  resolveTargets: async ({ cfg, accountId, inputs, kind, runtime }) =>
    (await loadMatrixChannelRuntime()).resolveMatrixTargets({
      cfg,
      accountId,
      inputs,
      kind,
      runtime,
    }),
};
