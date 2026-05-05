import Foundation
import AVFoundation
import Speech
import Combine
import os.log

/// Manages wake word detection using on-device speech recognition.
final class VoiceWakeManager: ObservableObject {

    enum State {
        case idle, listening, cooldown, detected
    }

    @Published private(set) var state: State = .idle

    private let logger = Logger(subsystem: "ai.coreblow.app", category: "VoiceWake")
    private var audioEngine: AVAudioEngine?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let preferences: VoiceWakePreferences
    private var onWakeDetected: (() -> Void)?

    init(preferences: VoiceWakePreferences, onWakeDetected: (() -> Void)? = nil) {
        self.preferences = preferences
        self.onWakeDetected = onWakeDetected
    }

    func startListening() {
        guard state == .idle, preferences.isEnabled else { return }

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement)
            try session.setActive(true)
        } catch {
            logger.error("Audio session failed: \(error.localizedDescription)")
            return
        }

        audioEngine = AVAudioEngine()
        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()

        guard let audioEngine, let request = recognitionRequest else { return }
        request.shouldReportPartialResults = true
        request.requiresOnDeviceRecognition = true

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)

        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            self?.recognitionRequest?.append(buffer)
        }

        recognitionTask = speechRecognizer?.recognitionTask(with: request) { [weak self] result, error in
            guard let self, let result else { return }
            let text = result.bestTranscription.formattedString.lowercased()

            if text.contains(self.preferences.wakePhrase.lowercased()) {
                self.handleWakeDetected()
            }
        }

        do {
            audioEngine.prepare()
            try audioEngine.start()
            state = .listening
            logger.info("Wake listening started (phrase: \(self.preferences.wakePhrase))")
        } catch {
            logger.error("Wake engine start failed: \(error.localizedDescription)")
        }
    }

    func stopListening() {
        audioEngine?.stop()
        audioEngine?.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        audioEngine = nil
        recognitionRequest = nil
        recognitionTask = nil
        state = .idle
        logger.info("Wake listening stopped")
    }

    private func handleWakeDetected() {
        state = .detected
        logger.info("Wake word detected!")

        if preferences.hapticFeedback {
            #if os(iOS)
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)
            #endif
        }

        stopListening()
        onWakeDetected?()

        // Cooldown before re-listening
        DispatchQueue.main.asyncAfter(deadline: .now() + TalkDefaults.wakeCooldown) { [weak self] in
            self?.state = .idle
            if self?.preferences.isEnabled == true {
                self?.startListening()
            }
        }
    }
}
