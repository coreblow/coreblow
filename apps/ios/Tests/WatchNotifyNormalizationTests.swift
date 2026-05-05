import Testing
@testable import CoreBlow

@Suite("NodeAppModel+WatchNotify")
struct WatchNotifyNormalizationTests {
    @Test func trimmedOrNilReturnsNilForBlanks() {
        #expect(NodeAppModel.trimmedOrNil(nil) == nil)
        #expect(NodeAppModel.trimmedOrNil("") == nil)
        #expect(NodeAppModel.trimmedOrNil("   ") == nil)
    }

    @Test func trimmedOrNilReturnsTrimmedValue() {
        #expect(NodeAppModel.trimmedOrNil("  hello  ") == "hello")
    }

    @Test func normalizedWatchRiskFromPriority() {
        #expect(NodeAppModel.normalizedWatchRisk(nil, priority: .passive) == .low)
        #expect(NodeAppModel.normalizedWatchRisk(nil, priority: .active) == .medium)
        #expect(NodeAppModel.normalizedWatchRisk(nil, priority: .timeSensitive) == .high)
    }

    @Test func normalizedWatchPriorityFromRisk() {
        #expect(NodeAppModel.normalizedWatchPriority(nil, risk: .low) == .passive)
        #expect(NodeAppModel.normalizedWatchPriority(nil, risk: .medium) == .active)
        #expect(NodeAppModel.normalizedWatchPriority(nil, risk: .high) == .timeSensitive)
    }

    @Test func normalizeWatchActionsLimitsToFour() {
        let actions = (0..<10).map { NodeAppModel.WatchAction(id: "a\($0)", label: "L\($0)") }
        let result = NodeAppModel.normalizeWatchActions(actions, kind: nil, promptId: nil)
        #expect(result.count == 4)
    }
}
