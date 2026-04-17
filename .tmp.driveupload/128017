// @ts-nocheck
import { createNonExitingRuntime, type RuntimeEnv } from "coreblow/plugin-sdk/runtime-env";
import { normalizeStringEntries } from "coreblow/plugin-sdk/text-runtime";
import type { MonitorIMessageOpts } from "./types.js";

export function resolveRuntime(opts: MonitorIMessageOpts): RuntimeEnv {
  return opts.runtime ?? createNonExitingRuntime();
}

export function normalizeAllowList(list?: Array<string | number>) {
  return normalizeStringEntries(list);
}

// Runtime aliases
let _rt: ImessageRuntime | undefined;
export function getIMessageRuntime(): ImessageRuntime { if (!_rt) _rt = new ImessageRuntime(); return _rt; }
export function setIMessageRuntime(r: ImessageRuntime) { _rt = r; }
