import Foundation

/// Connection mode options during onboarding.
enum OnboardingConnectionMode: String, CaseIterable {
    case scan = "scan"
    case qrCode = "qr"
    case manual = "manual"

    var label: String {
        switch self {
        case .scan: return "Scan Network"
        case .qrCode: return "Scan QR Code"
        case .manual: return "Enter Manually"
        }
    }

    var icon: String {
        switch self {
        case .scan: return "antenna.radiowaves.left.and.right"
        case .qrCode: return "qrcode.viewfinder"
        case .manual: return "keyboard"
        }
    }
}

/// Persistent onboarding state management.
enum OnboardingStateStore {
    private static let completedKey = "onboarding.completed"
    private static let lastModeKey = "onboarding.lastMode"

    static var isCompleted: Bool {
        get { UserDefaults.standard.bool(forKey: completedKey) }
        set { UserDefaults.standard.set(newValue, forKey: completedKey) }
    }

    static var lastMode: OnboardingConnectionMode? {
        get {
            guard let raw = UserDefaults.standard.string(forKey: lastModeKey) else { return nil }
            return OnboardingConnectionMode(rawValue: raw)
        }
        set { UserDefaults.standard.set(newValue?.rawValue, forKey: lastModeKey) }
    }

    static func markCompleted(mode: OnboardingConnectionMode) {
        isCompleted = true
        lastMode = mode
    }

    static func reset() {
        isCompleted = false
        lastMode = nil
    }
}
