import Foundation
enum VoiceWakeGlobalSettingsSync {
    static func sync(enabled: Bool, triggerWords: [String]) { UserDefaults.standard.set(enabled, forKey: "voice.wake"); UserDefaults.standard.set(triggerWords, forKey: "voice.triggerWords") }
    static func load() -> (enabled: Bool, words: [String]) { (UserDefaults.standard.bool(forKey: "voice.wake"), UserDefaults.standard.stringArray(forKey: "voice.triggerWords") ?? ["hey coreblow"]) }
}
