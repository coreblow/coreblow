import Testing
@testable import CoreBlow

@Suite("WatchReplyCoordinator")
struct WatchReplyCoordinatorTests {
    @Test @MainActor func dropsMissingFields() {
        let coord = WatchReplyCoordinator()
        let event = WatchReplyCoordinator.WatchQuickReplyEvent(replyId: "", actionId: "a", payload: nil)
        let decision = coord.ingest(event, isGatewayConnected: true)
        if case .dropMissingFields = decision {} else {
            Issue.record("Expected dropMissingFields")
        }
    }

    @Test @MainActor func deduplicatesReplyIds() {
        let coord = WatchReplyCoordinator()
        let e1 = WatchReplyCoordinator.WatchQuickReplyEvent(replyId: "r1", actionId: "a1", payload: nil)
        _ = coord.ingest(e1, isGatewayConnected: true)
        let decision = coord.ingest(e1, isGatewayConnected: true)
        if case .deduped = decision {} else {
            Issue.record("Expected deduped")
        }
    }

    @Test @MainActor func queuesWhenDisconnected() {
        let coord = WatchReplyCoordinator()
        let event = WatchReplyCoordinator.WatchQuickReplyEvent(replyId: "r2", actionId: "a2", payload: nil)
        let decision = coord.ingest(event, isGatewayConnected: false)
        if case .queue = decision {} else {
            Issue.record("Expected queue")
        }
        #expect(coord.queuedCount == 1)
    }

    @Test @MainActor func drainsWhenConnected() {
        let coord = WatchReplyCoordinator()
        let event = WatchReplyCoordinator.WatchQuickReplyEvent(replyId: "r3", actionId: "a3", payload: nil)
        _ = coord.ingest(event, isGatewayConnected: false)
        let drained = coord.drainIfConnected(true)
        #expect(drained.count == 1)
        #expect(coord.queuedCount == 0)
    }
}
