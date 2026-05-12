import AppKit
import OSLog
import CoreBlowKit
import OSLog

/// Available chime identifiers for voice wake events.
enum VoiceWakeChime: Equatable, Sendable {
    case `default`
    case subtle
    case bright
    case confirm
    case none
    case system(name: String)
    case custom(displayName: String, bookmark: Data)

    var rawValue: String {
        switch self {
        case .default: return "default"
        case .subtle: return "subtle"
        case .bright: return "bright"
        case .confirm: return "confirm"
        case .none: return "none"
        case .system(let name): return "system.\(name)"
        case .custom(let displayName, _): return "custom.\(displayName)"
        }
    }

    init?(rawValue: String) {
        switch rawValue {
        case "default": self = .default
        case "subtle": self = .subtle
        case "bright": self = .bright
        case "confirm": self = .confirm
        case "none": self = .none
        default:
            if rawValue.hasPrefix("system.") {
                self = .system(name: String(rawValue.dropFirst(7)))
            } else {
                return nil
            }
        }
    }

    var displayName: String {
        switch self {
        case .default: return "Default"
        case .subtle: return "Subtle"
        case .bright: return "Bright"
        case .confirm: return "Confirm"
        case .none: return "None"
        case .system(let name): return name
        case .custom(let name, _): return name
        }
    }

    /// Label for display in the chime picker menu.
    var displayLabel: String { displayName }

    static let detected = VoiceWakeChime.default
    static let empty = VoiceWakeChime.none

    /// Play this chime sound.
    static func play() { NSSound(named: "Tink")?.play() }

    func playSound() {
        guard self != .none else { return }
        switch self {
        case .system(let name):
            NSSound(named: name)?.play()
        case .custom(_, let bookmark):
            var isStale = false
            guard let url = try? URL(
                resolvingBookmarkData: bookmark,
                options: [.withSecurityScope],
                bookmarkDataIsStale: &isStale),
                url.startAccessingSecurityScopedResource()
            else { return }
            defer { url.stopAccessingSecurityScopedResource() }
            NSSound(contentsOf: url, byReference: true)?.play()
        default:
            NSSound(named: "Tink")?.play()
        }
    }
}
