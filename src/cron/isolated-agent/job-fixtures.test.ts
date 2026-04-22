import { describe, expect, it } from "vitest";
import {
  makeIsolatedAgentJobFixture,
  makeIsolatedAgentParamsFixture,
} from "./job-fixtures.js";

describe("makeIsolatedAgentJobFixture", () => {
  it("returns an object with id field", () => {
    const job = makeIsolatedAgentJobFixture();
    expect(job).toHaveProperty("id");
    expect(typeof job.id).toBe("string");
  });

  it("returns an object with name field", () => {
    const job = makeIsolatedAgentJobFixture();
    expect(job).toHaveProperty("name");
  });

  it("returns an object with schedule field", () => {
    const job = makeIsolatedAgentJobFixture();
    expect(job).toHaveProperty("schedule");
  });

  it("returns an object with sessionTarget=isolated by default", () => {
    const job = makeIsolatedAgentJobFixture();
    expect(job.sessionTarget).toBe("isolated");
  });

  it("returns an object with payload.kind=agentTurn by default", () => {
    const job = makeIsolatedAgentJobFixture();
    expect((job.payload as never as { kind: string }).kind).toBe("agentTurn");
  });

  it("applies overrides to default fixture", () => {
    const job = makeIsolatedAgentJobFixture({ id: "custom-job" });
    expect(job.id).toBe("custom-job");
  });

  it("does not throw for undefined overrides", () => {
    expect(() => makeIsolatedAgentJobFixture()).not.toThrow();
    expect(() => makeIsolatedAgentJobFixture(undefined)).not.toThrow();
  });
});

describe("makeIsolatedAgentParamsFixture", () => {
  it("returns an object with cfg field", () => {
    const params = makeIsolatedAgentParamsFixture();
    expect(params).toHaveProperty("cfg");
  });

  it("returns an object with job field", () => {
    const params = makeIsolatedAgentParamsFixture();
    expect(params).toHaveProperty("job");
  });

  it("returns an object with sessionKey field", () => {
    const params = makeIsolatedAgentParamsFixture();
    expect(params).toHaveProperty("sessionKey");
  });

  it("sessionKey starts with cron: by default", () => {
    const params = makeIsolatedAgentParamsFixture();
    expect(typeof params.sessionKey).toBe("string");
  });

  it("applies top-level overrides", () => {
    const params = makeIsolatedAgentParamsFixture({ sessionKey: "cron:override" });
    expect(params.sessionKey).toBe("cron:override");
  });

  it("applies nested job overrides via job key", () => {
    const params = makeIsolatedAgentParamsFixture({ job: { id: "nested-job" } });
    expect(params.job.id).toBe("nested-job");
  });
});
