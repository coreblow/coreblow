import Foundation

/// Persistent preferences for voice wake behavior.
final class VoiceWakePreferences: ObservableObject {

    private let defaults: UserDefaults

    private enum Keys {
        static let isEnabled = "voiceWake.isEnabled"
        static let wakePhrase = "voiceWake.wakePhrase"
        static let sensitivity = "voiceWake.sensitivity"
        static let hapticFeedback = "voiceWake.hapticFeedback"
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var isEnabled: Bool {
        get { defaults.bool(forKey: Keys.isEnabled) }
        set { defaults.set(newValue, forKey: Keys.isEnabled); objectWillChange.send() }
    }

    var wakePhrase: String {
        get { defaults.string(forKey: Keys.wakePhrase) ?? TalkDefaults.defaultWakePhrase }
        set {
            let trimmed = newValue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if !trimmed.isEmpty {
                defaults.set(trimmed, forKey: Keys.wakePhrase)
                objectWillChange.send()
            }
        }
    }

    var sensitivity: Float {
        get {
            let val = defaults.float(forKey: Keys.sensitivity)
            return val > 0 ? val : TalkDefaults.minWakeConfidence
        }
        set {
            defaults.set(max(0.1, min(1.0, newValue)), forKey: Keys.sensitivity)
            objectWillChange.send()
        }
    }

    var hapticFeedback: Bool {
        get { defaults.object(forKey: Keys.hapticFeedback) as? Bool ?? true }
        set { defaults.set(newValue, forKey: Keys.hapticFeedback); objectWillChange.send() }
    }
}
