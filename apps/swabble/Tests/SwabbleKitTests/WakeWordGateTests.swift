import Testing
@testable import SwabbleKit

@Suite struct WakeWordGateTests {
    @Test func textOnlyMatch() {
        #expect(WakeWordGate.matchesTextOnly(text: "hey cored turn on lights", triggers: ["cored"]))
        #expect(WakeWordGate.matchesTextOnly(text: "hey coreblow turn on lights", triggers: ["cored", "coreblow"]))
        #expect(!WakeWordGate.matchesTextOnly(text: "hello world", triggers: ["cored"]))
    }
    @Test func stripWake() {
        let result = WakeWordGate.stripWake(text: "hey cored turn on lights", triggers: ["cored"])
        #expect(result == "hey turn on lights")
    }
    @Test func emptyTextNoMatch() {
        #expect(!WakeWordGate.matchesTextOnly(text: "", triggers: ["cored"]))
    }
}
