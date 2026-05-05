import SwabbleKit
import Foundation; import OSLog; import Speech
@MainActor final class VoiceWakeRuntime {
    private let logger = CoreBlowLogging.voice; private var recognizer: SFSpeechRecognizer?; private var audioEngine: AVAudioEngine?
    private(set) var isListening = false; var onCommand: ((String) -> Void)?
    func start(triggerWords: [String]) { guard !isListening else { return }; recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US")); audioEngine = AVAudioEngine(); isListening = true; logger.info("Voice wake started") }
    func stop() { audioEngine?.stop(); audioEngine = nil; isListening = false; logger.info("Voice wake stopped") }
}
