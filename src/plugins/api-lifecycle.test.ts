import { describe, expect, it } from "vitest";
import {
  getPluginApiMethodLifecyclePolicy,
  isLateCallablePluginApiMethod,
  type PluginApiLifecyclePolicy,
} from "./api-lifecycle.js";

describe("getPluginApiMethodLifecyclePolicy", () => {
  it("returns policy for known runtime late-callable method", () => {
    const policy = getPluginApiMethodLifecyclePolicy("emitAgentEvent");
    expect(policy).toEqual<PluginApiLifecyclePolicy>({
      phase: "runtime",
      lateCallable: true,
    });
  });

  it("returns policy for sendSessionAttachment", () => {
    const policy = getPluginApiMethodLifecyclePolicy("sendSessionAttachment");
    expect(policy).toEqual<PluginApiLifecyclePolicy>({
      phase: "runtime",
      lateCallable: true,
    });
  });

  it("returns policy for scheduleSessionTurn", () => {
    const policy = getPluginApiMethodLifecyclePolicy("scheduleSessionTurn");
    expect(policy).toEqual<PluginApiLifecyclePolicy>({
      phase: "runtime",
      lateCallable: true,
    });
  });

  it("returns policy for unscheduleSessionTurnsByTag", () => {
    const policy = getPluginApiMethodLifecyclePolicy("unscheduleSessionTurnsByTag");
    expect(policy).toEqual<PluginApiLifecyclePolicy>({
      phase: "runtime",
      lateCallable: true,
    });
  });

  it("returns undefined for unknown method", () => {
    const policy = getPluginApiMethodLifecyclePolicy("unknownMethod");
    expect(policy).toBeUndefined();
  });

  it("returns undefined for non-late-callable method", () => {
    const policy = getPluginApiMethodLifecyclePolicy("someOtherMethod");
    expect(policy).toBeUndefined();
  });
});

describe("isLateCallablePluginApiMethod", () => {
  it("returns true for known late-callable method", () => {
    expect(isLateCallablePluginApiMethod("emitAgentEvent")).toBe(true);
    expect(isLateCallablePluginApiMethod("sendSessionAttachment")).toBe(true);
    expect(isLateCallablePluginApiMethod("scheduleSessionTurn")).toBe(true);
    expect(isLateCallablePluginApiMethod("unscheduleSessionTurnsByTag")).toBe(true);
  });

  it("returns false for unknown method", () => {
    expect(isLateCallablePluginApiMethod("unknownMethod")).toBe(false);
  });

  it("returns false for method without policy", () => {
    expect(isLateCallablePluginApiMethod("someOtherApiMethod")).toBe(false);
  });

  it("returns false for non-late-callable method if policy phase is not late-callable", () => {
    expect(isLateCallablePluginApiMethod("notLateCallable")).toBe(false);
  });
});
