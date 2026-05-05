import Foundation; import Observation
@MainActor @Observable final class VoiceWakeTester {
    private(set) var lastTranscript: String?; private(set) var lastCommand: String?; private(set) var isTesting = false
    func startTest(triggerWords: [String]) { isTesting = true }
    func stopTest() { isTesting = false }
    func simulateTranscript(_ text: String, triggerWords: [String]) { lastTranscript = text; lastCommand = VoiceWakeHelpers.extractCommand(from: text, triggerWords: triggerWords) }
}
