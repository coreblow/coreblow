import AVFoundation
import CoreBlowKit
import Foundation
import OSLog
import Speech

private let talkLogger = Logger(subsystem: "ai.coreblow", category: "talk.mode")

/// Speech-to-text ↔ gateway ↔ TTS runtime for conversational talk mode.
///
/// Manages the full lifecycle: microphone → speech recognition → gateway agent call → TTS playback.
actor TalkModeRuntime {
    static let shared = TalkModeRuntime()

    // MARK: - Types

    enum PlaybackPlan: Equatable {
        case system
        case elevenLabs
        case none
    }

    enum TalkState: Equatable {
        case idle
        case listening
        case recognizing
        case thinking
        case speaking
        case paused
    }

    // MARK: - RMS Meter

    private final class RMSMeter: @unchecked Sendable {
        private var rms: Double = 0
        private let lock = NSLock()

        func set(_ rms: Double) {
            lock.lock()
            self.rms = rms
            lock.unlock()
        }

        func get() -> Double {
            lock.lock()
            defer { lock.unlock() }
            return rms
        }
    }

    // MARK: - State

    private(set) var state: TalkState = .idle
    private var generation = 0
    private var isPaused = false

    // Audio
    private var audioEngine: AVAudioEngine?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private var rmsMeter = RMSMeter()

    // Silence detection
    private var silenceTimer: Task<Void, Never>?
    private var lastSpeechTime = Date()
    private let silenceThreshold: TimeInterval = 1.5

    // Transcript
    private var currentTranscript = ""
    private var isFinal = false

    // MARK: - Configuration

    static func configureRecognitionRequest(_ request: SFSpeechAudioBufferRecognitionRequest) {
        request.shouldReportPartialResults = true
        request.requiresOnDeviceRecognition = false
    }

    // MARK: - Lifecycle

    func setEnabled(_ enabled: Bool) async {
        if enabled {
            generation += 1
            await start()
        } else {
            generation += 1
            await stop()
        }
    }

    func setPaused(_ paused: Bool) async {
        isPaused = paused
        if paused {
            state = .paused
            await stopRecognition()
            silenceTimer?.cancel()
            silenceTimer = nil
            await notifyUI()
        } else {
            await startListening()
        }
    }

    private func isCurrent(_ gen: Int) -> Bool { gen == generation }

    // MARK: - Start/Stop

    func start() async {
        guard state == .idle || state == .paused else { return }
        let gen = generation

        // Request permissions
        let audioAuthorized = await withCheckedContinuation { cont in
            AVCaptureDevice.requestAccess(for: .audio) { granted in
                cont.resume(returning: granted)
            }
        }
        guard audioAuthorized, isCurrent(gen) else {
            talkLogger.warning("Talk mode: audio permission denied")
            return
        }

        let speechAuthorized = await withCheckedContinuation { cont in
            SFSpeechRecognizer.requestAuthorization { status in
                cont.resume(returning: status == .authorized)
            }
        }
        guard speechAuthorized, isCurrent(gen) else {
            talkLogger.warning("Talk mode: speech recognition permission denied")
            return
        }

        // Notify gateway
        await GatewayConnection.shared.talkMode(enabled: true, phase: "listening")

        await startListening()
    }

    func stop() async {
        state = .idle
        await stopRecognition()
        silenceTimer?.cancel()
        silenceTimer = nil
        currentTranscript = ""
        isFinal = false

        await GatewayConnection.shared.talkMode(enabled: false)
        await notifyUI()
    }

    // MARK: - Speech Recognition

    private struct RecognitionUpdate {
        var text: String
        var isFinal: Bool
        var rms: Double
    }

    private func startRecognition() async {
        guard speechRecognizer?.isAvailable == true else {
            talkLogger.warning("Speech recognizer not available")
            return
        }

        let engine = AVAudioEngine()
        let request = SFSpeechAudioBufferRecognitionRequest()
        Self.configureRecognitionRequest(request)

        let inputNode = engine.inputNode
        let format = inputNode.outputFormat(forBus: 0)

        let meter = rmsMeter
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            request.append(buffer)
            // Calculate RMS
            guard let channelData = buffer.floatChannelData?[0] else { return }
            let frames = Int(buffer.frameLength)
            var sum: Float = 0
            for i in 0..<frames { sum += channelData[i] * channelData[i] }
            let rms = Double(sqrt(sum / Float(max(frames, 1))))
            meter.set(rms)
            _ = self // prevent dealloc
        }

        do {
            try engine.start()
        } catch {
            talkLogger.error("Audio engine start failed: \(error.localizedDescription)")
            return
        }

        audioEngine = engine
        recognitionRequest = request

        let gen = generation
        recognitionTask = speechRecognizer?.recognitionTask(with: request) { [weak self] result, error in
            guard let self else { return }
            let text = result?.bestTranscription.formattedString
            let isFinal = result?.isFinal ?? false
            let rmsValue = meter.get()
            Task { @Sendable in
                guard await self.isCurrent(gen) else { return }
                if let text {
                    await self.handleRecognition(RecognitionUpdate(
                        text: text,
                        isFinal: isFinal,
                        rms: rmsValue))
                }
                if error != nil {
                    await self.handleRecognitionError()
                }
            }
        }

        startSilenceMonitor()
        state = .listening
        lastSpeechTime = Date()
        await notifyUI()
    }

    private func stopRecognition() async {
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        audioEngine?.stop()
        audioEngine?.inputNode.removeTap(onBus: 0)
        audioEngine = nil
    }

    private func startSilenceMonitor() {
        silenceTimer?.cancel()
        silenceTimer = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 300_000_000) // 300ms
                await self?.checkSilence()
            }
        }
    }

    // MARK: - Recognition Handling

    private func handleRecognition(_ update: RecognitionUpdate) async {
        currentTranscript = update.text
        isFinal = update.isFinal

        if !update.text.isEmpty {
            lastSpeechTime = Date()
            state = .recognizing
            await notifyUI()
        }

        if update.isFinal {
            await finalizeTranscript(update.text)
        }
    }

    private func handleRecognitionError() async {
        // On error, restart recognition if still active
        guard state != .idle, !isPaused else { return }
        await stopRecognition()
        try? await Task.sleep(nanoseconds: 500_000_000)
        if state != .idle, !isPaused {
            await startRecognition()
        }
    }

    // MARK: - Silence Detection

    private func checkSilence() async {
        guard state == .recognizing else { return }
        let elapsed = Date().timeIntervalSince(lastSpeechTime)
        if elapsed >= silenceThreshold, !currentTranscript.isEmpty {
            await finalizeTranscript(currentTranscript)
        }
    }

    private func startListening() async {
        state = .listening
        currentTranscript = ""
        isFinal = false
        await startRecognition()
        await notifyUI()
    }

    private func finalizeTranscript(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            await startListening()
            return
        }

        state = .thinking
        await notifyUI()
        await stopRecognition()

        let gen = generation

        // Send to gateway and speak response
        await sendAndSpeak(trimmed)

        guard isCurrent(gen) else { return }

        // Return to listening
        if state != .idle, !isPaused {
            await startListening()
        }
    }

    // MARK: - Gateway + TTS

    private func sendAndSpeak(_ transcript: String) async {
        let gen = generation
        let mainSessionKey = await GatewayConnection.shared.mainSessionKey()
        let sendTimestamp = Date().timeIntervalSince1970 * 1000

        let result = await GatewayConnection.shared.sendAgent(
            message: transcript,
            thinking: "default",
            sessionKey: mainSessionKey,
            deliver: false,
            to: nil)

        guard isCurrent(gen) else { return }

        if !result.ok {
            talkLogger.warning("Talk mode agent send failed: \(result.error ?? "unknown")")
            return
        }

        // Wait for assistant response
        state = .speaking
        await notifyUI()

        let assistantText = await waitForAssistantText(
            sessionKey: mainSessionKey,
            since: sendTimestamp,
            maxWaitSeconds: 60)

        guard isCurrent(gen), let assistantText, !assistantText.isEmpty else {
            talkLogger.info("Talk mode: no assistant response received")
            return
        }

        // Play TTS
        await playAssistant(text: assistantText)
    }

    private func waitForAssistantText(
        sessionKey: String,
        since: Double?,
        maxWaitSeconds: Int = 60
    ) async -> String? {
        let startTime = Date()
        while Date().timeIntervalSince(startTime) < Double(maxWaitSeconds) {
            if let text = await latestAssistantText(sessionKey: sessionKey, since: since) {
                return text
            }
            try? await Task.sleep(nanoseconds: 500_000_000) // 500ms
            if state == .idle { return nil }
        }
        return nil
    }

    private struct HistoryResponse: Decodable {
        struct Message: Decodable {
            let role: String
            let content: String
            let ts: Double?
        }
        let messages: [Message]
    }

    private func latestAssistantText(sessionKey: String, since: Double? = nil) async -> String? {
        do {
            let data = try await GatewayConnection.shared.requestRaw(
                method: "chat.history",
                params: [
                    "sessionKey": CoreBlowKit.AnyCodable(sessionKey),
                    "limit": CoreBlowKit.AnyCodable(5),
                ])

            let response = try JSONDecoder().decode(HistoryResponse.self, from: data)

            let candidates = response.messages.filter { msg in
                msg.role == "assistant" && !msg.content.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines).isEmpty
            }

            if let since {
                return candidates.last(where: { ($0.ts ?? 0) >= since })?.content
            }
            return candidates.last?.content
        } catch {
            talkLogger.warning("Talk mode: failed to fetch history: \(error.localizedDescription)")
            return nil
        }
    }

    // MARK: - TTS Playback

    private func playAssistant(text: String) async {
        guard let input = preparePlaybackInput(text: text) else { return }
        let plan = Self.resolvePlaybackPlan()

        switch plan {
        case .system:
            await playSystemTTS(text: input.cleanedText)
        case .elevenLabs:
            let apiKey = self.apiKey ?? UserDefaults.standard.string(forKey: "coreblow.tts.elevenLabsApiKey") ?? ""
            let voiceId = currentVoiceId ?? defaultVoiceId ?? "21m00Tcm4TlvDq8ikWAM"
            do {
                try await playElevenLabs(text: input.cleanedText, apiKey: apiKey, voiceId: voiceId)
            } catch {
                talkLogger.warning("ElevenLabs TTS failed, falling back to system: \(error.localizedDescription)")
                await playSystemTTS(text: input.cleanedText)
            }
        case .none:
            talkLogger.info("Talk mode: TTS playback disabled")
        }

        if state == .speaking {
            state = .thinking
            await notifyUI()
        }
    }

    static func resolvePlaybackPlan() -> PlaybackPlan {
        let disabled = UserDefaults.standard.bool(forKey: "coreblow.tts.disabled")
        if disabled { return .none }

        let apiKey = UserDefaults.standard.string(forKey: "coreblow.tts.elevenLabsApiKey")?
            .trimmingCharacters(in: CharacterSet.whitespacesAndNewlines)
        if let apiKey, !apiKey.isEmpty {
            return .elevenLabs
        }

        return .system
    }

    // MARK: - Playback Input Preparation

    private struct TalkPlaybackInput {
        let generation: Int
        let cleanedText: String
        let directive: TalkDirective?
        let apiKey: String?
        let voiceId: String?
        let language: String?
        let synthTimeoutSeconds: Double
    }

    private func preparePlaybackInput(text: String) -> TalkPlaybackInput? {
        let gen = generation
        let parse = TalkDirectiveParser.parse(text)
        let directive = parse.directive
        let cleaned = parse.stripped.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty else { return nil }

        let requestedVoice = directive?.voiceId?.trimmingCharacters(in: .whitespacesAndNewlines)
        let resolvedVoice = resolveVoiceAlias(requestedVoice)
        if let resolvedVoice {
            if directive?.once == true {
                talkLogger.info("Talk voice override (once) voiceId=\(resolvedVoice)")
            } else {
                currentVoiceId = resolvedVoice
                voiceOverrideActive = true
            }
        }

        if let model = directive?.modelId {
            if directive?.once == true {
                talkLogger.info("Talk model override (once) modelId=\(model)")
            } else {
                currentModelId = model
                modelOverrideActive = true
            }
        }

        let apiKey = self.apiKey?.trimmingCharacters(in: .whitespacesAndNewlines)
        let preferredVoice = resolvedVoice ?? currentVoiceId ?? defaultVoiceId
        let synthTimeoutSeconds = max(20.0, min(90.0, Double(cleaned.count) * 0.12))
        lastSpokenText = cleaned

        return TalkPlaybackInput(
            generation: gen,
            cleanedText: cleaned,
            directive: directive,
            apiKey: apiKey,
            voiceId: preferredVoice,
            language: directive?.language,
            synthTimeoutSeconds: synthTimeoutSeconds)
    }

    // MARK: - Voice Alias Resolution

    private var defaultVoiceId: String?
    private var currentVoiceId: String?
    private var defaultModelId: String?
    private var currentModelId: String?
    private var voiceOverrideActive = false
    private var modelOverrideActive = false
    private var defaultOutputFormat: String?
    private var interruptOnSpeech: Bool = true
    private var lastInterruptedAtSeconds: Double?
    private var voiceAliases: [String: String] = [:]
    private var lastSpokenText: String?
    private var apiKey: String?
    private var fallbackVoiceId: String?

    private var noiseFloorRMS: Double = 1e-4
    private let minSpeechRMS: Double = 1e-3
    private let speechBoostFactor: Double = 6.0
    private var lastSpeechEnergyAt: Date?

    private func resolveVoiceAlias(_ value: String?) -> String? {
        let trimmed = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        let normalized = trimmed.lowercased()
        if let mapped = voiceAliases[normalized] { return mapped }
        if voiceAliases.values.contains(where: { $0.caseInsensitiveCompare(trimmed) == .orderedSame }) {
            return trimmed
        }
        return Self.isLikelyVoiceId(trimmed) ? trimmed : nil
    }

    private static func isLikelyVoiceId(_ value: String) -> Bool {
        guard value.count >= 10 else { return false }
        return value.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }
    }

    // MARK: - Config Reload

    private func reloadConfig() async {
        let env = ProcessInfo.processInfo.environment
        let envVoice = env["ELEVENLABS_VOICE_ID"]?.trimmingCharacters(in: .whitespacesAndNewlines)
        let envApiKey = env["ELEVENLABS_API_KEY"]?.trimmingCharacters(in: .whitespacesAndNewlines)

        if let envApiKey, !envApiKey.isEmpty {
            apiKey = envApiKey
        }
        if let envVoice, !envVoice.isEmpty {
            defaultVoiceId = envVoice
            if !voiceOverrideActive {
                currentVoiceId = envVoice
            }
        }
    }

    // MARK: - System TTS

    private func playSystemTTS(text: String) async {
        let synthesizer = AVSpeechSynthesizer()
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: Locale.current.language.languageCode?.identifier ?? "en")
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate
        utterance.pitchMultiplier = 1.0
        utterance.volume = 1.0

        let delegate = SystemTTSDelegate()
        synthesizer.delegate = delegate

        state = .speaking
        await notifyUI()

        synthesizer.speak(utterance)

        await withCheckedContinuation { cont in
            delegate.onFinish = { cont.resume() }
        }
    }

    // MARK: - ElevenLabs TTS

    private func playElevenLabs(text: String, apiKey: String, voiceId: String) async throws {
        let url = URL(string: "https://api.elevenlabs.io/v1/text-to-speech/\(voiceId)/stream")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "xi-api-key")

        let modelId = currentModelId ?? defaultModelId ?? "eleven_v3"
        let payload: [String: Any] = [
            "text": text,
            "model_id": modelId,
            "voice_settings": [
                "stability": 0.5,
                "similarity_boost": 0.75,
            ],
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        state = .speaking
        await notifyUI()

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
            throw ElevenLabsError.httpError(statusCode: statusCode)
        }

        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("coreblow_tts_\(UUID().uuidString).mp3")
        try data.write(to: tempURL)
        defer { try? FileManager.default.removeItem(at: tempURL) }

        let player = try AVAudioPlayer(contentsOf: tempURL)
        let delegate = AudioPlayerDelegate()
        player.delegate = delegate
        player.play()

        await withCheckedContinuation { cont in
            delegate.onFinish = { cont.resume() }
        }
    }

    // MARK: - Audio Level Handling

    private func noteAudioLevel(rms: Double) async {
        guard state == .listening || state == .speaking else { return }
        let alpha: Double = rms < noiseFloorRMS ? 0.08 : 0.01
        noiseFloorRMS = max(1e-7, noiseFloorRMS + (rms - noiseFloorRMS) * alpha)

        let threshold = max(minSpeechRMS, noiseFloorRMS * speechBoostFactor)
        if rms >= threshold {
            let now = Date()
            lastSpeechTime = now
            lastSpeechEnergyAt = now
        }
    }

    private static func rmsLevel(buffer: AVAudioPCMBuffer) -> Double? {
        guard let channelData = buffer.floatChannelData?.pointee else { return nil }
        let frameCount = Int(buffer.frameLength)
        guard frameCount > 0 else { return nil }
        var sum: Double = 0
        for i in 0..<frameCount {
            let sample = Double(channelData[i])
            sum += sample * sample
        }
        return sqrt(sum / Double(frameCount))
    }

    // MARK: - Interrupt Detection

    private func shouldInterrupt(transcript: String, hasConfidence: Bool) async -> Bool {
        let trimmed = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 3 else { return false }
        if isLikelyEcho(of: trimmed) { return false }
        let now = Date()
        if let lastSpeechEnergyAt, now.timeIntervalSince(lastSpeechEnergyAt) > 0.35 {
            return false
        }
        return hasConfidence
    }

    private func isLikelyEcho(of transcript: String) -> Bool {
        guard let spoken = lastSpokenText?.lowercased(), !spoken.isEmpty else { return false }
        let probe = transcript.lowercased()
        if probe.count < 6 {
            return spoken.contains(probe)
        }
        return spoken.contains(probe)
    }

    func stopSpeaking(reason: TalkStopReason) async {
        guard state == .speaking else { return }
        if reason == .speech {
            lastInterruptedAtSeconds = Date().timeIntervalSince1970
        }
        state = .thinking
        await notifyUI()
    }

    // MARK: - TTS Validation

    private static func resolveSpeed(speed: Double?, rateWPM: Int?) -> Double? {
        if let rateWPM, rateWPM > 0 {
            let resolved = Double(rateWPM) / 175.0
            if resolved <= 0.5 || resolved >= 2.0 { return nil }
            return resolved
        }
        if let speed {
            if speed <= 0.5 || speed >= 2.0 { return nil }
            return speed
        }
        return nil
    }

    private static func validatedUnit(_ value: Double?) -> Double? {
        guard let value else { return nil }
        if value < 0 || value > 1 { return nil }
        return value
    }

    private static func validatedSeed(_ value: Int?) -> UInt32? {
        guard let value else { return nil }
        if value < 0 || value > 4_294_967_295 { return nil }
        return UInt32(value)
    }

    // MARK: - UI Notification

    private func notifyUI() async {
        let currentState = state
        let transcript = currentTranscript
        let rms = rmsMeter.get()
        await MainActor.run {
            NotificationCenter.default.post(
                name: .coreBlowTalkModeStateChanged,
                object: nil,
                userInfo: [
                    "state": String(describing: currentState),
                    "transcript": transcript,
                    "rms": rms,
                ])
        }
    }

    // MARK: - Public Accessors

    var isActive: Bool { state != .idle }
    var isRecording: Bool { state == .listening || state == .recognizing }
    var currentRMS: Double { rmsMeter.get() }
}

// MARK: - Notifications

extension Notification.Name {
    static let coreBlowTalkModeStateChanged = Notification.Name("coreBlowTalkModeStateChanged")
}

// MARK: - Stop Reason


// MARK: - Talk Directive

struct TalkDirective {
    var voiceId: String?
    var modelId: String?
    var language: String?
    var once: Bool?
    var speed: Double?
    var rateWPM: Int?
    var stability: Double?
    var similarity: Double?
    var style: Double?
    var speakerBoost: Bool?
    var seed: Int?
    var normalize: String?
    var latencyTier: Int?
    var outputFormat: String?
}

// MARK: - Talk Directive Parser

enum TalkDirectiveParser {
    struct ParseResult {
        let directive: TalkDirective?
        let stripped: String
        let unknownKeys: [String]
    }

    static func parse(_ text: String) -> ParseResult {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("/talk") {
            let stripped = trimmed.replacingOccurrences(of: "/talk", with: "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            return ParseResult(directive: TalkDirective(), stripped: stripped, unknownKeys: [])
        }
        return ParseResult(directive: nil, stripped: trimmed, unknownKeys: [])
    }
}

// MARK: - ElevenLabs Error

enum ElevenLabsError: Error, LocalizedError {
    case httpError(statusCode: Int)

    var errorDescription: String? {
        switch self {
        case .httpError(let code): "ElevenLabs API error (HTTP \(code))"
        }
    }
}

// MARK: - System TTS Delegate

private final class SystemTTSDelegate: NSObject, AVSpeechSynthesizerDelegate {
    var onFinish: (() -> Void)?

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        onFinish?()
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        onFinish?()
    }
}

// MARK: - Audio Player Delegate

private final class AudioPlayerDelegate: NSObject, AVAudioPlayerDelegate {
    var onFinish: (() -> Void)?

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        onFinish?()
    }

    func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        onFinish?()
    }
}
