import Testing
@testable import SwabbleKit

@Suite struct WakeWordGateTests {
    @Test func textOnlyMatch() {
        #expect(WakeWordGate.matchesTextOnly(text: "hey clawd turn on lights", triggers: ["clawd"]))
        #expect(!WakeWordGate.matchesTextOnly(text: "hello world", triggers: ["clawd"]))
    }
    @Test func stripWake() {
        let result = WakeWordGate.stripWake(text: "hey clawd turn on lights", triggers: ["clawd"])
        #expect(result == "hey turn on lights")
    }
    @Test func emptyTextNoMatch() {
        #expect(!WakeWordGate.matchesTextOnly(text: "", triggers: ["clawd"]))
    }
}
