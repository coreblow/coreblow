import Foundation; import Observation
@MainActor @Observable final class ExecApprovals {
    struct PendingApproval: Identifiable, Sendable { let id: String; let command: [String]; let cwd: String?; let requestedAt: Date }
    private(set) var pending: [PendingApproval] = []
    func add(_ approval: PendingApproval) { pending.append(approval) }
    func approve(id: String) { pending.removeAll { $0.id == id } }
    func deny(id: String) { pending.removeAll { $0.id == id } }
    func clear() { pending.removeAll() }
}
