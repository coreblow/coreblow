import AVFoundation
import OSLog
import CoreBlowKit
import OSLog
import Foundation
import CoreBlowKit

/// Catalog of available chime sounds for voice wake events.
enum VoiceWakeChimeCatalog {
    static let triggerChimes: [(id: String, label: String)] = [
        ("default", "Default"),
        ("subtle", "Subtle"),
        ("bright", "Bright"),
        ("none", "None"),
    ]

    static let sendChimes: [(id: String, label: String)] = [
        ("default", "Default"),
        ("confirm", "Confirm"),
        ("none", "None"),
    ]

    /// System sound options for chime picker menus.
    static let systemOptions: [String] = ["Tink", "Pop", "Purr", "Funk", "Frog", "Hero", "Morse"]

    /// Display name for a system sound option.
    static func displayName(for option: String) -> String { option }
}

/// Plays chime sounds for voice wake events.
final class VoiceWakeChimePlayer: @unchecked Sendable {
    static let shared = VoiceWakeChimePlayer()

    private var player: AVAudioPlayer?

    private init() {}

    func play(_ chime: VoiceWakeChime) {
        guard chime != .none else { return }
        guard let url = Bundle.main.url(forResource: "chime_\(chime.rawValue)", withExtension: "caf")
            ?? Bundle.main.url(forResource: "chime_default", withExtension: "caf")
        else {
            chime.playSound()
            return
        }

        do {
            player = try AVAudioPlayer(contentsOf: url)
            player?.volume = 0.4
            player?.play()
        } catch {
            chime.playSound()
        }
    }

    /// Play a chime with an optional reason for diagnostics.
    func play(_ chime: VoiceWakeChime, reason: String) {
        play(chime)
    }

    /// Static convenience to play a chime on the shared instance.
    @MainActor static func play(_ chime: VoiceWakeChime) {
        shared.play(chime)
    }

    /// Static convenience to play a chime with a reason on the shared instance.
    @MainActor static func play(_ chime: VoiceWakeChime, reason: String) {
        shared.play(chime, reason: reason)
    }

    func playTrigger(_ chimeId: String) {
        play(VoiceWakeChime(rawValue: chimeId) ?? .default)
    }

    func playSend(_ chimeId: String) {
        play(VoiceWakeChime(rawValue: chimeId) ?? .confirm)
    }
}
