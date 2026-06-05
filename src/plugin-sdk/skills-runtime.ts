export function bumpSkillsSnapshotVersion(_params: {
  workspaceDir?: string;
  reason?: string;
  changedPath?: string;
}): void {
  // CoreBlow refreshes skill state through its own runtime; this facade keeps
  // plugin-side skill writers decoupled from that implementation detail.
}
