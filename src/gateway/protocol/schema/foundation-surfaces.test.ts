import { Value } from "typebox/value";
import { describe, expect, it } from "vitest";
import { ArtifactsDownloadResultSchema } from "./artifacts.js";
import { CommandsListResultSchema } from "./commands.js";
import { EnvironmentsStatusResultSchema } from "./environments.js";
import { PluginsSessionActionResultSchema } from "./plugins.js";
import { TasksCancelResultSchema, TasksListParamsSchema } from "./tasks.js";

describe("gateway foundation surface schemas", () => {
  it("validates artifact download contracts strictly", () => {
    const artifact = {
      id: "artifact-1",
      type: "image",
      title: "Preview",
      download: { mode: "bytes" },
    };

    expect(
      Value.Check(ArtifactsDownloadResultSchema, {
        artifact,
        encoding: "base64",
        data: "AA==",
      }),
    ).toBe(true);
    expect(
      Value.Check(ArtifactsDownloadResultSchema, {
        artifact,
        data: "AA==",
        unexpected: true,
      }),
    ).toBe(false);
  });

  it("validates bounded command list contracts", () => {
    const command = {
      name: "status",
      description: "Display runtime status",
      category: "status",
      source: "native",
      scope: "both",
      acceptsArgs: false,
    };

    expect(Value.Check(CommandsListResultSchema, { commands: [command] })).toBe(true);
    expect(
      Value.Check(CommandsListResultSchema, {
        commands: [{ ...command, source: "remote" }],
      }),
    ).toBe(false);
  });

  it("validates environment status summaries", () => {
    expect(
      Value.Check(EnvironmentsStatusResultSchema, {
        id: "sandbox",
        type: "local",
        status: "available",
      }),
    ).toBe(true);
    expect(
      Value.Check(EnvironmentsStatusResultSchema, {
        id: "sandbox",
        type: "local",
        status: "online",
      }),
    ).toBe(false);
  });

  it("distinguishes plugin action success and failure responses", () => {
    expect(
      Value.Check(PluginsSessionActionResultSchema, {
        ok: true,
        continueAgent: false,
        result: { selected: true },
      }),
    ).toBe(true);
    expect(
      Value.Check(PluginsSessionActionResultSchema, {
        ok: false,
        error: "action failed",
        code: "denied",
      }),
    ).toBe(true);
    expect(
      Value.Check(PluginsSessionActionResultSchema, {
        ok: false,
        error: "action failed",
        unexpected: true,
      }),
    ).toBe(false);
  });

  it("validates task filters and cancellation results", () => {
    expect(
      Value.Check(TasksListParamsSchema, {
        status: ["queued", "running"],
        limit: 25,
      }),
    ).toBe(true);
    expect(Value.Check(TasksListParamsSchema, { limit: 0 })).toBe(false);
    expect(
      Value.Check(TasksCancelResultSchema, {
        found: true,
        cancelled: true,
        task: { id: "task-1", status: "cancelled" },
      }),
    ).toBe(true);
  });
});
