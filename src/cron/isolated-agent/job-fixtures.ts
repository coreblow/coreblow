type LooseRecord = Record<string, unknown>;

export function makeIsolatedAgentJobFixture(overrides?: LooseRecord) {
  return {
    id: "test-job",
    name: "Test Job",
    schedule: { kind: "cron" as const, expr: "0 9 * * *", tz: "UTC" },
    sessionTarget: "isolated",
    payload: { kind: "agentTurn", message: "test" },
    ...overrides,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeIsolatedAgentParamsFixture(overrides?: LooseRecord): any {
  const jobOverrides =
    overrides && "job" in overrides ? (overrides.job as LooseRecord | undefined) : undefined;
  return {
    cfg: {},
    deps: {} as never,
    job: makeIsolatedAgentJobFixture(jobOverrides),
    message: "test",
    sessionKey: "cron:test",
    ...overrides,
  };
}
