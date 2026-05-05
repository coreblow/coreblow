import Foundation
import AVFoundation
import Speech
import Combine
import os.log

/// Manages the talk mode lifecycle: recording, speech recognition, and TTS.
final class TalkModeManager: ObservableObject {

    // MARK: - State

    enum State {
        case inactive, recording, processing, speaking, error
    }

    @Published private(set) var state: State = .inactive
    @Published private(set) var lastTranscript = ""
    @Published private(set) var audioLevel: Float = 0

    // MARK: - Private

    private let logger = Logger(subsystem: "ai.coreblow.app", category: "TalkMode")
    private var audioEngine: AVAudioEngine?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let synthesizer = AVSpeechSynthesizer()
    private var silenceTimer: Timer?
    private var config = TalkModeGatewayConfig()

    // MARK: - Public API

    func updateConfig(_ config: TalkModeGatewayConfig) {
        self.config = config
    }

    func startRecording() {
        guard state == .inactive else { return }

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            logger.error("Audio session setup failed: \(error.localizedDescription)")
            state = .error
            return
        }

        audioEngine = AVAudioEngine()
        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()

        guard let audioEngine, let request = recognitionRequest else { return }
        request.shouldReportPartialResults = true

        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)

        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
            self?.recognitionRequest?.append(buffer)
            self?.updateAudioLevel(buffer: buffer)
        }

        recognitionTask = speechRecognizer?.recognitionTask(with: request) { [weak self] result, error in
            guard let self else { return }
            if let result {
                self.lastTranscript = result.bestTranscription.formattedString
                self.resetSilenceTimer()
            }
            if error != nil || (result?.isFinal ?? false) {
                self.stopRecording()
            }
        }

        do {
            audioEngine.prepare()
            try audioEngine.start()
            state = .recording
            startSilenceTimer()
            logger.info("Recording started")
        } catch {
            logger.error("Audio engine start failed: \(error.localizedDescription)")
            state = .error
        }
    }

    func stopRecording() {
        audioEngine?.stop()
        audioEngine?.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        silenceTimer?.invalidate()
        audioEngine = nil
        recognitionRequest = nil
        recognitionTask = nil
        audioLevel = 0

        if !lastTranscript.isEmpty {
            state = .processing
        } else {
            state = .inactive
        }
        logger.info("Recording stopped")
    }

    func speak(_ text: String) {
        state = .speaking
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: config.language)
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate
        synthesizer.speak(utterance)
        logger.info("Speaking: \(text.prefix(50))")

        DispatchQueue.main.asyncAfter(deadline: .now() + Double(text.count) * 0.06 + 1) { [weak self] in
            self?.state = .inactive
        }
    }

    func reset() {
        stopRecording()
        synthesizer.stopSpeaking(at: .immediate)
        lastTranscript = ""
        state = .inactive
    }

    // MARK: - Private

    private func updateAudioLevel(buffer: AVAudioPCMBuffer) {
        guard let data = buffer.floatChannelData?[0] else { return }
        let count = Int(buffer.frameLength)
        var sum: Float = 0
        for i in 0..<count { sum += data[i] * data[i] }
        let rms = sqrt(sum / Float(max(count, 1)))
        DispatchQueue.main.async { self.audioLevel = rms }
    }

    private func startSilenceTimer() {
        silenceTimer = Timer.scheduledTimer(withTimeInterval: config.silenceTimeout, repeats: false) { [weak self] _ in
            self?.logger.info("Silence timeout reached")
            self?.stopRecording()
        }
    }

    private func resetSilenceTimer() {
        silenceTimer?.invalidate()
        startSilenceTimer()
    }
}
