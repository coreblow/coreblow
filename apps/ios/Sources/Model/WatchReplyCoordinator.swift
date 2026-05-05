import Foundation

/// Coordinates watch quick-reply deduplication and queueing.
@MainActor
final class WatchReplyCoordinator {

    enum Decision {
        case dropMissingFields
        case deduped(replyId: String)
        case queue(replyId: String, actionId: String)
        case forward
    }

    struct WatchQuickReplyEvent {
        let replyId: String
        let actionId: String
        let payload: String?
    }

    private var queuedReplies: [WatchQuickReplyEvent] = []
    private var seenReplyIds = Set<String>()

    func ingest(_ event: WatchQuickReplyEvent, isGatewayConnected: Bool) -> Decision {
        let replyId = event.replyId.trimmingCharacters(in: .whitespacesAndNewlines)
        let actionId = event.actionId.trimmingCharacters(in: .whitespacesAndNewlines)
        if replyId.isEmpty || actionId.isEmpty {
            return .dropMissingFields
        }
        if seenReplyIds.contains(replyId) {
            return .deduped(replyId: replyId)
        }
        seenReplyIds.insert(replyId)
        if !isGatewayConnected {
            queuedReplies.append(event)
            return .queue(replyId: replyId, actionId: actionId)
        }
        return .forward
    }

    func drainIfConnected(_ isGatewayConnected: Bool) -> [WatchQuickReplyEvent] {
        guard isGatewayConnected, !queuedReplies.isEmpty else { return [] }
        let pending = queuedReplies
        queuedReplies.removeAll()
        return pending
    }

    func requeueFront(_ event: WatchQuickReplyEvent) {
        queuedReplies.insert(event, at: 0)
    }

    var queuedCount: Int {
        queuedReplies.count
    }
}
