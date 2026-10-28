export {
  type SkillsChangeEvent,
  bumpSkillsSnapshotVersion,
  getSkillsSnapshotVersion,
  registerSkillsChangeListener,
} from "./refresh.js";

export function shouldRefreshSnapshotForVersion(
  cachedVersion?: number,
  nextVersion?: number,
): boolean {
  const cached = typeof cachedVersion === "number" ? cachedVersion : 0;
  const next = typeof nextVersion === "number" ? nextVersion : 0;
  return next === 0 ? cached > 0 : cached < next;
}
