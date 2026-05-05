import Foundation; import Observation
@MainActor @Observable final class VoiceSessionCoordinator {
    private(set) var isInSession = false; private var wakeRuntime: VoiceWakeRuntime?
    func startSession() { isInSession = true }
    func endSession() { isInSession = false }
}
