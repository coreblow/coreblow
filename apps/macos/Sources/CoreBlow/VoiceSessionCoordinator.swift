import AppKit
import OSLog
import CoreBlowKit
import OSLog
import Foundation
import CoreBlowKit

/// Coordinates voice sessions from wake-word detection and push-to-talk.
@MainActor
final class VoiceSessionCoordinator: @unchecked Sendable {
    static let shared = VoiceSessionCoordinator()

    enum Source: String, Sendable { case wakeWord, pushToTalk }
    enum DismissReason: String, Sendable { case explicit, timeout, cancelled }
    enum DismissOutcome: String, Sendable { case empty, sent, cancelled }

    struct Session {
        let token: UUID
        let source: Source
        var text: String
        var attributed: NSAttributedString?
        var isFinal: Bool
        var forwardEnabled: Bool
    }

    private(set) var activeSession: Session?
    private var sessionListeners: [(Session) -> Void] = []

    private init() {}

    // MARK: - Start

    func startSession(source: Source) -> UUID {
        let token = UUID()
        activeSession = Session(token: token, source: source, text: "", isFinal: false, forwardEnabled: true)
        return token
    }

    func startSession(
        source: Source, text: String,
        attributed: NSAttributedString?, forwardEnabled: Bool
    ) -> UUID {
        let token = UUID()
        activeSession = Session(
            token: token, source: source, text: text,
            attributed: attributed, isFinal: false, forwardEnabled: forwardEnabled)
        return token
    }

    // MARK: - Update

    func updateSession(token: UUID, text: String, attributed: NSAttributedString? = nil, isFinal: Bool = false) {
        guard activeSession?.token == token else { return }
        activeSession?.text = text
        activeSession?.attributed = attributed
        activeSession?.isFinal = isFinal
        if let session = activeSession {
            sessionListeners.forEach { $0(session) }
        }
    }

    func updatePartial(token: UUID, text: String, attributed: NSAttributedString?) {
        updateSession(token: token, text: text, attributed: attributed, isFinal: false)
    }

    func updateLevel(token: UUID, _ level: Double) {
        micLevel = min(max(level, 0), 1)
    }

    // MARK: - Finalize / Dismiss

    func finalize(
        token: UUID, text: String,
        sendChime: VoiceWakeChime, autoSendAfter: TimeInterval
    ) {
        guard activeSession?.token == token else { return }
        activeSession?.text = text
        activeSession?.isFinal = true
        if sendChime != .none {
            VoiceWakeChimePlayer.play(sendChime, reason: "voicewake.send")
        }
        if !text.isEmpty {
            Task.detached {
                await VoiceWakeForwarder.forward(transcript: text)
            }
        }
        activeSession = nil
    }

    func dismiss(token: UUID, reason: DismissReason, outcome: DismissOutcome) {
        guard activeSession?.token == token else { return }
        activeSession = nil
    }

    func endSession(token: UUID) {
        guard activeSession?.token == token else { return }
        activeSession = nil
    }

    func addListener(_ handler: @escaping (Session) -> Void) {
        sessionListeners.append(handler)
    }

    var isActive: Bool { activeSession != nil }

    /// Current microphone input level (0.0–1.0).
    private(set) var micLevel: Double = 0

    func updateLevel(_ level: Double) {
        micLevel = min(max(level, 0), 1)
    }
}
