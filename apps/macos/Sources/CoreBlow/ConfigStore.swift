import Foundation
import Observation
@MainActor @Observable
final class ConfigStore {
    var gatewayHost: String = "localhost"
    var gatewayPort: UInt16 = 3000
    var useTLS = false
    var autoStart = true
    var showInDock = false
    var showInMenuBar = true
    var enableVoiceWake = false
    var voiceTriggerWords: [String] = ["hey coreblow"]
    private let defaults = UserDefaults.standard
    private enum Keys { static let host = "gateway.host"; static let port = "gateway.port"
        static let tls = "gateway.tls"; static let autoStart = "gateway.autoStart"
        static let dock = "app.showInDock"; static let menuBar = "app.showInMenuBar"
        static let voiceWake = "voice.wake"; static let triggerWords = "voice.triggerWords" }
    func load() {
        gatewayHost = defaults.string(forKey: Keys.host) ?? "localhost"
        gatewayPort = UInt16(defaults.integer(forKey: Keys.port)); if gatewayPort == 0 { gatewayPort = 3000 }
        useTLS = defaults.bool(forKey: Keys.tls); autoStart = defaults.bool(forKey: Keys.autoStart)
        showInDock = defaults.bool(forKey: Keys.dock); showInMenuBar = defaults.object(forKey: Keys.menuBar) != nil ? defaults.bool(forKey: Keys.menuBar) : true
        enableVoiceWake = defaults.bool(forKey: Keys.voiceWake)
        voiceTriggerWords = defaults.stringArray(forKey: Keys.triggerWords) ?? ["hey coreblow"]
    }
    func save() {
        defaults.set(gatewayHost, forKey: Keys.host); defaults.set(Int(gatewayPort), forKey: Keys.port)
        defaults.set(useTLS, forKey: Keys.tls); defaults.set(autoStart, forKey: Keys.autoStart)
        defaults.set(showInDock, forKey: Keys.dock); defaults.set(showInMenuBar, forKey: Keys.menuBar)
        defaults.set(enableVoiceWake, forKey: Keys.voiceWake); defaults.set(voiceTriggerWords, forKey: Keys.triggerWords)
    }
}
