import Foundation
actor CoalescingFSEventsWatcher { private var pending: Task<Void, Never>?; let delay: TimeInterval; let action: @Sendable () -> Void
    init(delay: TimeInterval = 0.5, action: @escaping @Sendable () -> Void) { self.delay = delay; self.action = action }
    func trigger() { pending?.cancel(); pending = Task { try? await Task.sleep(for: .seconds(delay)); guard !Task.isCancelled else { return }; action() } }
}
