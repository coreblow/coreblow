export function normalizeSample(sample) {
  return {
    release: String(sample.release ?? "").trim(),
    region: String(sample.region ?? "local").trim() || "local",
    milliseconds: Math.max(0, Number(sample.milliseconds ?? 0)),
  };
}

export function summarizeSamples(samples) {
  const normalized = samples.map(normalizeSample);
  const total = normalized.reduce((sum, sample) => sum + sample.milliseconds, 0);
  return {
    count: normalized.length,
    averageMilliseconds: normalized.length === 0 ? 0 : total / normalized.length,
  };
}
