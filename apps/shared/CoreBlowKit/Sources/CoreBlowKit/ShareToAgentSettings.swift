import Foundation

/// CoreBlow: Original implementation of Share Extension settings persistence.
/// 1. Pattern borrowed: Managing default instructions for shared content via UserDefaults.
/// 2. Implemented differently: Uses App Groups `UserDefaults` explicitly to ensure cross-process visibility between the iOS main app and the Share Extension, and encapsulates logic in `CoreBlowSharePreferences`.

public struct CoreBlowSharePreferences {

    // Replace with actual App Group identifier in production
    private static let appGroupIdentifier = "group.coreblow.shared"
    private static let defaultInstructionKey = "CoreBlow.ShareExtension.DefaultInstruction"

    /// Resolves the correct UserDefaults suite for cross-process sharing.
    private static var sharedDefaults: UserDefaults {
        if let suite = UserDefaults(suiteName: appGroupIdentifier) {
            return suite
        }
        return UserDefaults.standard
    }

    /// Retrieves the user's saved default instruction, or a generic default if none exists.
    public static func fetchDefaultInstruction() -> String {
        if let saved = sharedDefaults.string(forKey: defaultInstructionKey), !saved.isEmpty {
            return saved
        }
        return "Please review this shared content."
    }

    /// Persists a new default instruction, removing the key if nil or empty.
    public static func updateDefaultInstruction(_ instruction: String?) {
        guard let instruction = instruction?.trimmingCharacters(in: .whitespacesAndNewlines), !instruction.isEmpty else {
            sharedDefaults.removeObject(forKey: defaultInstructionKey)
            return
        }

        sharedDefaults.set(instruction, forKey: defaultInstructionKey)
    }
}
