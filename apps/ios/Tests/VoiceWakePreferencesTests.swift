import Foundation
import Testing
@testable import CoreBlow

@Suite("VoiceWakePreferences")
struct VoiceWakePreferencesTests {
    @Test func defaultTriggerWordsAreNotEmpty() {
        let prefs = VoiceWakePreferences()
        let words = prefs.triggerWords
        #expect(!words.isEmpty)
    }

    @Test func sanitizeRemovesBlanks() {
        let input = ["hey coreblow", "", "  ", "ok coreblow"]
        let result = VoiceWakePreferences.sanitizeTriggerWords(input)
        #expect(result.count == 2)
        #expect(result.contains("hey coreblow"))
        #expect(result.contains("ok coreblow"))
    }
}
