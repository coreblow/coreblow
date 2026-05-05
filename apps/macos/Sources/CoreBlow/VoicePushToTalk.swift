import Carbon; import Foundation
@MainActor final class VoicePushToTalk {
    private(set) var isActive = false; var onStart: (() -> Void)?; var onStop: (() -> Void)?
    func activate() { isActive = true; onStart?() }
    func deactivate() { isActive = false; onStop?() }
}
