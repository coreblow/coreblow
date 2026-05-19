export function scoreRun(metrics) {
  const reliability = clamp(metrics?.reliability ?? 0);
  const correctness = clamp(metrics?.correctness ?? 0);
  const latency = clamp(metrics?.latency ?? 0);
  return Math.round((correctness * 0.5 + reliability * 0.35 + latency * 0.15) * 1000) / 1000;
}

function clamp(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.min(1, Math.max(0, number));
}
