const staleDays = 30;

export function classifyItem(item, now = new Date()) {
  const labels = Array.isArray(item?.labels) ? item.labels : [];
  if (labels.includes("security")) {
    return { action: "escalate", reason: "security label present" };
  }
  if (labels.includes("release-blocker")) {
    return { action: "escalate", reason: "release blocker" };
  }
  const updatedAt = item?.updatedAt ? new Date(item.updatedAt) : null;
  if (updatedAt && Number.isFinite(updatedAt.getTime())) {
    const ageDays = Math.floor((now.getTime() - updatedAt.getTime()) / 86_400_000);
    if (ageDays >= staleDays) {
      return { action: "review-stale", reason: `${ageDays} days since update` };
    }
  }
  return { action: "monitor", reason: "no triage action required" };
}
