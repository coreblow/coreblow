import AVFoundation
import Foundation
import OSLog
import Speech
import SwabbleKit
#if canImport(AppKit)
import AppKit
#endif

/// Background listener that keeps the voice-wake pipeline alive outside the
/// settings test view. Integrates with `WakeWordGate` from SwabbleKit for
/// segment-timed wake-word detection, with text-only fallback when timing
/// is unavailable.
actor VoiceWakeRuntime {
    static let shared = VoiceWakeRuntime()

    enum ListeningState { case idle, voiceWake, pushToTalk }

    private let logger = Logger(subsystem: "ai.coreblow", category: "voicewake.runtime")

    private var recognizer: SFSpeechRecognizer?
    // Lazily created on start to avoid creating an AVAudioEngine at app launch,
    // which can switch Bluetooth headphones into the low-quality headset profile
    // even if Voice Wake is disabled.
    private var audioEngine: AVAudioEngine?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var recognitionGeneration: Int = 0
    private var lastHeard: Date?
    private var noiseFloorRMS: Double = 1e-4
    private var captureStartedAt: Date?
    private var captureTask: Task<Void, Never>?
    private var capturedTranscript: String = ""
    private var isCapturing: Bool = false
    private var heardBeyondTrigger: Bool = false
    private var triggerChimePlayed: Bool = false
    private var committedTranscript: String = ""
    private var volatileTranscript: String = ""
    private var cooldownUntil: Date?
    private var currentConfig: RuntimeConfig?
    private var listeningState: ListeningState = .idle
    private var overlayToken: UUID?
    private var activeTriggerEndTime: TimeInterval?
    private var scheduledRestartTask: Task<Void, Never>?
    private var lastLoggedText: String?
    private var lastLoggedAt: Date?
    private var lastTapLogAt: Date?
    private var lastCallbackLogAt: Date?
    private var lastTranscript: String?
    private var lastTranscriptAt: Date?
    private var preDetectTask: Task<Void, Never>?
    private var isStarting: Bool = false
    private var triggerOnlyTask: Task<Void, Never>?

    // MARK: - Tunables

    private let silenceWindow: TimeInterval = 2.0
    private let triggerOnlySilenceWindow: TimeInterval = 5.0
    private let captureHardStop: TimeInterval = 120.0
    private let debounceAfterSend: TimeInterval = 0.35
    private let minSpeechRMS: Double = 1e-3
    private let speechBoostFactor: Double = 6.0
    private let preDetectSilenceWindow: TimeInterval = 1.0
    private let triggerPauseWindow: TimeInterval = 0.55

    // MARK: - Types

    struct RuntimeConfig: Equatable {
        let triggers: [String]
        let micID: String?
        let localeID: String?
        let triggerChime: VoiceWakeChime
        let sendChime: VoiceWakeChime
    }

    private struct RecognitionUpdate {
        let transcript: String?
        let segments: [WakeWordSegment]
        let isFinal: Bool
        let error: Error?
        let generation: Int
    }

    // MARK: - Public API

    func refresh(state: AppState) async {
        let snapshot = await MainActor.run { () -> (Bool, RuntimeConfig) in
            let enabled = state.swabbleEnabled
            let config = RuntimeConfig(
                triggers: sanitizeVoiceWakeTriggers(state.swabbleTriggerWords),
                micID: state.voiceWakeMicID.isEmpty ? nil : state.voiceWakeMicID,
                localeID: state.voiceWakeLocaleID.isEmpty ? nil : state.voiceWakeLocaleID,
                triggerChime: state.voiceWakeTriggerChime,
                sendChime: state.voiceWakeSendChime)
            return (enabled, config)
        }

        guard voiceWakeSupported, snapshot.0 else {
            stop()
            return
        }

        guard PermissionManager.voiceWakePermissionsGranted() else {
            logger.debug("voicewake runtime not starting: permissions missing")
            stop()
            return
        }

        let config = snapshot.1

        if isStarting { return }
        if scheduledRestartTask != nil, config == currentConfig, recognitionTask == nil { return }
        if scheduledRestartTask != nil {
            scheduledRestartTask?.cancel()
            scheduledRestartTask = nil
        }
        if config == currentConfig, recognitionTask != nil { return }

        stop()
        await start(with: config)
    }

    func applyPushToTalkCooldown() {
        cooldownUntil = Date().addingTimeInterval(debounceAfterSend)
    }

    func pauseForPushToTalk() {
        listeningState = .pushToTalk
        stop(dismissOverlay: false)
    }

    // MARK: - Pipeline Management

    private func haltRecognitionPipeline() {
        recognitionGeneration &+= 1
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        audioEngine?.inputNode.removeTap(onBus: 0)
        audioEngine?.stop()
        audioEngine = nil
    }

    private func start(with config: RuntimeConfig) async {
        if isStarting { return }
        isStarting = true
        defer { isStarting = false }
        do {
            recognitionGeneration &+= 1
            let generation = recognitionGeneration

            configureSession(localeID: config.localeID)

            guard let recognizer, recognizer.isAvailable else {
                logger.error("voicewake runtime: speech recognizer unavailable")
                return
            }

            recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
            recognitionRequest?.shouldReportPartialResults = true
            recognitionRequest?.taskHint = .dictation
            guard let request = recognitionRequest else { return }

            if audioEngine == nil { audioEngine = AVAudioEngine() }
            guard let audioEngine else { return }

            guard AudioInputDeviceObserver.hasUsableDefaultInputDevice() else {
                self.audioEngine = nil
                throw NSError(
                    domain: "VoiceWakeRuntime", code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "No usable audio input device available"])
            }

            let input = audioEngine.inputNode
            let format = input.outputFormat(forBus: 0)
            guard format.channelCount > 0, format.sampleRate > 0 else {
                throw NSError(
                    domain: "VoiceWakeRuntime", code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "No audio input available"])
            }
            input.removeTap(onBus: 0)
            input.installTap(onBus: 0, bufferSize: 2048, format: format) { [weak self, weak request] buffer, _ in
                request?.append(buffer)
                guard let rms = Self.rmsLevel(buffer: buffer) else { return }
                Task.detached { [weak self] in
                    await self?.noteAudioLevel(rms: rms)
                    await self?.noteAudioTap(rms: rms)
                }
            }

            audioEngine.prepare()
            try audioEngine.start()

            currentConfig = config
            lastHeard = Date()

            recognitionTask = recognizer.recognitionTask(with: request) { [weak self, generation] result, error in
                guard let self else { return }
                let transcript = result?.bestTranscription.formattedString
                let segments = result.flatMap { r in
                    transcript.map { WakeWordSpeechSegments.from(transcription: r.bestTranscription, transcript: $0) }
                } ?? []
                let isFinal = result?.isFinal ?? false
                Task { await self.noteRecognitionCallback(transcript: transcript, isFinal: isFinal, error: error) }
                let update = RecognitionUpdate(
                    transcript: transcript, segments: segments,
                    isFinal: isFinal, error: error, generation: generation)
                Task { await self.handleRecognition(update, config: config) }
            }

            let preferred = config.micID?.isEmpty == false ? config.micID! : "system-default"
            logger.info(
                "voicewake runtime input preferred=\(preferred, privacy: .public) "
                    + "\(AudioInputDeviceObserver.defaultInputDeviceSummary(), privacy: .public)")
            logger.info("voicewake runtime started")
            DiagnosticsFileLog.shared.log(category: "voicewake.runtime", event: "started", fields: [
                "locale": config.localeID ?? "",
                "micID": config.micID ?? "",
            ])
        } catch {
            logger.error("voicewake runtime failed to start: \(error.localizedDescription, privacy: .public)")
            stop()
        }
    }

    private func stop(dismissOverlay: Bool = true, cancelScheduledRestart: Bool = true) {
        if cancelScheduledRestart {
            scheduledRestartTask?.cancel()
            scheduledRestartTask = nil
        }
        captureTask?.cancel()
        captureTask = nil
        isCapturing = false
        capturedTranscript = ""
        captureStartedAt = nil
        triggerChimePlayed = false
        lastTranscript = nil
        lastTranscriptAt = nil
        preDetectTask?.cancel()
        preDetectTask = nil
        triggerOnlyTask?.cancel()
        triggerOnlyTask = nil
        haltRecognitionPipeline()
        recognizer = nil
        currentConfig = nil
        listeningState = .idle
        activeTriggerEndTime = nil
        logger.debug("voicewake runtime stopped")
        DiagnosticsFileLog.shared.log(category: "voicewake.runtime", event: "stopped")

        let token = overlayToken
        overlayToken = nil
        guard dismissOverlay else { return }
        Task { @MainActor in
            if let token {
                VoiceSessionCoordinator.shared.dismiss(token: token, reason: .explicit, outcome: .empty)
            } else {
                VoiceWakeOverlayController.shared.dismiss()
            }
        }
    }

    private func configureSession(localeID: String?) {
        let locale = localeID.flatMap { Locale(identifier: $0) } ?? Locale(identifier: Locale.current.identifier)
        recognizer = SFSpeechRecognizer(locale: locale)
        recognizer?.defaultTaskHint = .dictation
    }

    // MARK: - Recognition Handling

    private func handleRecognition(_ update: RecognitionUpdate, config: RuntimeConfig) async {
        if update.generation != recognitionGeneration { return }
        if let error = update.error {
            logger.debug("voicewake recognition error: \(error.localizedDescription, privacy: .public)")
        }

        guard let transcript = update.transcript else { return }

        let now = Date()
        if !transcript.isEmpty {
            lastHeard = now
            if !isCapturing {
                lastTranscript = transcript
                lastTranscriptAt = now
            }
            if isCapturing {
                maybeLogRecognition(
                    transcript: transcript, segments: update.segments,
                    triggers: config.triggers, isFinal: update.isFinal,
                    match: nil, usedFallback: false, capturing: true)
                let trimmed = Self.commandAfterTrigger(
                    transcript: transcript, segments: update.segments,
                    triggerEndTime: activeTriggerEndTime, triggers: config.triggers)
                capturedTranscript = trimmed
                updateHeardBeyondTrigger(withTrimmed: trimmed)
                if update.isFinal {
                    committedTranscript = trimmed
                    volatileTranscript = ""
                } else {
                    volatileTranscript = VoiceOverlayTextFormatting.delta(
                        after: committedTranscript, current: trimmed)
                }

                let attributed = VoiceOverlayTextFormatting.makeAttributed(
                    committed: committedTranscript, volatile: volatileTranscript, isFinal: update.isFinal)
                let snapshot = committedTranscript + volatileTranscript
                if let token = overlayToken {
                    await MainActor.run {
                        VoiceSessionCoordinator.shared.updatePartial(
                            token: token, text: snapshot, attributed: attributed)
                    }
                }
            }
        }

        if isCapturing { return }

        // Gate matching: try segment-timed first, fall back to text-only on final results
        let gateConfig = WakeWordGateConfig(triggers: config.triggers)
        var usedFallback = false
        var match = WakeWordGate.match(
            transcript: transcript, segments: update.segments, config: gateConfig)
        if match == nil, update.isFinal {
            match = VoiceWakeRecognitionDebugSupport.textOnlyFallbackMatch(
                transcript: transcript, triggers: config.triggers,
                config: gateConfig, trimWake: Self.trimmedAfterTrigger)
            usedFallback = match != nil
        }
        maybeLogRecognition(
            transcript: transcript, segments: update.segments,
            triggers: config.triggers, isFinal: update.isFinal,
            match: match, usedFallback: usedFallback, capturing: false)

        if let match {
            if let cooldown = cooldownUntil, now < cooldown { return }
            if usedFallback {
                logger.info("voicewake runtime detected (text-only fallback) len=\(match.command.count)")
            } else {
                logger.info("voicewake runtime detected len=\(match.command.count)")
            }
            await beginCapture(command: match.command, triggerEndTime: match.triggerEndTime, config: config)
        } else if !transcript.isEmpty, update.error == nil {
            if isTriggerOnly(transcript: transcript, triggers: config.triggers) {
                preDetectTask?.cancel()
                preDetectTask = nil
                scheduleTriggerOnlyPauseCheck(triggers: config.triggers, config: config)
            } else {
                triggerOnlyTask?.cancel()
                triggerOnlyTask = nil
                schedulePreDetectSilenceCheck(
                    triggers: config.triggers, gateConfig: gateConfig, config: config)
            }
        }
    }

    // MARK: - Logging

    private func maybeLogRecognition(
        transcript: String,
        segments: [WakeWordSegment],
        triggers: [String],
        isFinal: Bool,
        match: WakeWordGateMatch?,
        usedFallback: Bool,
        capturing: Bool)
    {
        guard VoiceWakeRecognitionDebugSupport.shouldLogTranscript(
            transcript: transcript, isFinal: isFinal, loggerLevel: logger.logLevel,
            lastLoggedText: &lastLoggedText, lastLoggedAt: &lastLoggedAt)
        else { return }

        let summary = VoiceWakeRecognitionDebugSupport.transcriptSummary(
            transcript: transcript, triggers: triggers, segments: segments)
        let matchSummary = VoiceWakeRecognitionDebugSupport.matchSummary(match)
        let segmentSummary = segments.map { seg in
            let start = String(format: "%.2f", seg.start)
            let end = String(format: "%.2f", seg.end)
            return "\(seg.text)@\(start)-\(end)"
        }.joined(separator: ", ")

        logger.debug(
            "voicewake runtime transcript='\(transcript, privacy: .private)' textOnly=\(summary.textOnly) "
                + "isFinal=\(isFinal) timing=\(summary.timingCount)/\(segments.count) "
                + "capturing=\(capturing) fallback=\(usedFallback) "
                + "\(matchSummary) segments=[\(segmentSummary, privacy: .private)]")
    }

    private func noteAudioTap(rms: Double) {
        let now = Date()
        if let last = lastTapLogAt, now.timeIntervalSince(last) < 1.0 { return }
        lastTapLogAt = now
        let db = 20 * log10(max(rms, 1e-7))
        logger.debug(
            "voicewake runtime audio tap rms=\(String(format: "%.6f", rms)) "
                + "db=\(String(format: "%.1f", db)) capturing=\(isCapturing)")
    }

    private func noteRecognitionCallback(transcript: String?, isFinal: Bool, error: Error?) {
        guard transcript?.isEmpty ?? true else { return }
        let now = Date()
        if let last = lastCallbackLogAt, now.timeIntervalSince(last) < 1.0 { return }
        lastCallbackLogAt = now
        let errorSummary = error?.localizedDescription ?? "none"
        logger.debug(
            "voicewake runtime callback empty transcript isFinal=\(isFinal) error=\(errorSummary, privacy: .public)")
    }

    // MARK: - Pre-Detect & Trigger-Only

    private func scheduleTriggerOnlyPauseCheck(triggers: [String], config: RuntimeConfig) {
        triggerOnlyTask?.cancel()
        let lastSeenAt = lastTranscriptAt
        let lastText = lastTranscript
        let windowNanos = UInt64(triggerPauseWindow * 1_000_000_000)
        triggerOnlyTask = Task { [weak self, lastSeenAt, lastText] in
            try? await Task.sleep(nanoseconds: windowNanos)
            guard let self else { return }
            await self.triggerOnlyPauseCheck(
                lastSeenAt: lastSeenAt, lastText: lastText,
                triggers: triggers, config: config)
        }
    }

    private func schedulePreDetectSilenceCheck(
        triggers: [String],
        gateConfig: WakeWordGateConfig,
        config: RuntimeConfig)
    {
        preDetectTask?.cancel()
        let lastSeenAt = lastTranscriptAt
        let lastText = lastTranscript
        let windowNanos = UInt64(preDetectSilenceWindow * 1_000_000_000)
        preDetectTask = Task { [weak self, lastSeenAt, lastText] in
            try? await Task.sleep(nanoseconds: windowNanos)
            guard let self else { return }
            await self.preDetectSilenceCheck(
                lastSeenAt: lastSeenAt, lastText: lastText,
                triggers: triggers, gateConfig: gateConfig, config: config)
        }
    }

    private func triggerOnlyPauseCheck(
        lastSeenAt: Date?, lastText: String?,
        triggers: [String], config: RuntimeConfig) async
    {
        guard !Task.isCancelled, !isCapturing else { return }
        guard let lastSeenAt, let lastText else { return }
        guard lastTranscriptAt == lastSeenAt, lastTranscript == lastText else { return }
        guard isTriggerOnly(transcript: lastText, triggers: triggers) else { return }
        if let cooldown = cooldownUntil, Date() < cooldown { return }
        logger.info("voicewake runtime detected (trigger-only pause)")
        await beginCapture(command: "", triggerEndTime: nil, config: config)
    }

    private func isTriggerOnly(transcript: String, triggers: [String]) -> Bool {
        guard WakeWordGate.matchesTextOnly(text: transcript, triggers: triggers) else { return false }
        guard VoiceWakeTextUtils.startsWithTrigger(transcript: transcript, triggers: triggers) else { return false }
        return Self.trimmedAfterTrigger(transcript, triggers: triggers).isEmpty
    }

    private func preDetectSilenceCheck(
        lastSeenAt: Date?, lastText: String?,
        triggers: [String],
        gateConfig: WakeWordGateConfig,
        config: RuntimeConfig) async
    {
        guard !Task.isCancelled, !isCapturing else { return }
        guard let lastSeenAt, let lastText else { return }
        guard lastTranscriptAt == lastSeenAt, lastTranscript == lastText else { return }
        guard let match = VoiceWakeRecognitionDebugSupport.textOnlyFallbackMatch(
            transcript: lastText, triggers: triggers,
            config: gateConfig, trimWake: Self.trimmedAfterTrigger)
        else { return }
        if let cooldown = cooldownUntil, Date() < cooldown { return }
        logger.info("voicewake runtime detected (silence fallback) len=\(match.command.count)")
        await beginCapture(command: match.command, triggerEndTime: match.triggerEndTime, config: config)
    }

    // MARK: - Capture

    private func beginCapture(command: String, triggerEndTime: TimeInterval?, config: RuntimeConfig) async {
        listeningState = .voiceWake
        isCapturing = true
        DiagnosticsFileLog.shared.log(category: "voicewake.runtime", event: "beginCapture")
        capturedTranscript = command
        committedTranscript = ""
        volatileTranscript = command
        captureStartedAt = Date()
        cooldownUntil = nil
        heardBeyondTrigger = !command.isEmpty
        triggerChimePlayed = false
        activeTriggerEndTime = triggerEndTime
        preDetectTask?.cancel()
        preDetectTask = nil
        triggerOnlyTask?.cancel()
        triggerOnlyTask = nil

        if config.triggerChime != .none, !triggerChimePlayed {
            triggerChimePlayed = true
            await MainActor.run { VoiceWakeChimePlayer.play(config.triggerChime, reason: "voicewake.trigger") }
        }

        let snapshot = committedTranscript + volatileTranscript
        let attributed = VoiceOverlayTextFormatting.makeAttributed(
            committed: committedTranscript, volatile: volatileTranscript, isFinal: false)
        overlayToken = await MainActor.run {
            VoiceSessionCoordinator.shared.startSession(
                source: .wakeWord, text: snapshot,
                attributed: attributed, forwardEnabled: true)
        }

        await MainActor.run { AppStateStore.shared.triggerVoiceEars(ttl: nil) }

        captureTask?.cancel()
        captureTask = Task { [weak self] in
            guard let self else { return }
            await self.monitorCapture(config: config)
        }
    }

    private func monitorCapture(config: RuntimeConfig) async {
        let start = captureStartedAt ?? Date()
        let hardStop = start.addingTimeInterval(captureHardStop)

        while isCapturing {
            let now = Date()
            if now >= hardStop {
                await finalizeCapture(config: config)
                return
            }
            let silenceThreshold = heardBeyondTrigger ? silenceWindow : triggerOnlySilenceWindow
            if let last = lastHeard, now.timeIntervalSince(last) >= silenceThreshold {
                await finalizeCapture(config: config)
                return
            }
            try? await Task.sleep(nanoseconds: 200_000_000)
        }
    }

    private func finalizeCapture(config: RuntimeConfig) async {
        guard isCapturing else { return }
        isCapturing = false
        cooldownUntil = Date().addingTimeInterval(debounceAfterSend)
        captureTask?.cancel()
        captureTask = nil

        let finalTranscript = capturedTranscript.trimmingCharacters(in: .whitespacesAndNewlines)
        DiagnosticsFileLog.shared.log(category: "voicewake.runtime", event: "finalizeCapture", fields: [
            "finalLen": "\(finalTranscript.count)",
        ])
        haltRecognitionPipeline()
        capturedTranscript = ""
        captureStartedAt = nil
        lastHeard = nil
        heardBeyondTrigger = false
        triggerChimePlayed = false
        activeTriggerEndTime = nil
        lastTranscript = nil
        lastTranscriptAt = nil
        preDetectTask?.cancel()
        preDetectTask = nil
        triggerOnlyTask?.cancel()
        triggerOnlyTask = nil

        await MainActor.run { AppStateStore.shared.stopVoiceEars() }
        if let token = overlayToken {
            await MainActor.run { VoiceSessionCoordinator.shared.updateLevel(token: token, 0) }
        }

        let delay: TimeInterval = 0.0
        let sendChime = finalTranscript.isEmpty ? .none : config.sendChime
        if let token = overlayToken {
            await MainActor.run {
                VoiceSessionCoordinator.shared.finalize(
                    token: token, text: finalTranscript,
                    sendChime: sendChime, autoSendAfter: delay)
            }
        } else if !finalTranscript.isEmpty {
            if sendChime != .none {
                await MainActor.run { VoiceWakeChimePlayer.play(sendChime, reason: "voicewake.send") }
            }
            Task.detached {
                await VoiceWakeForwarder.forward(transcript: finalTranscript)
            }
        }
        overlayToken = nil
        scheduleRestartRecognizer()
    }

    // MARK: - Audio Level

    private func noteAudioLevel(rms: Double) {
        guard isCapturing else { return }
        let alpha: Double = rms < noiseFloorRMS ? 0.08 : 0.01
        noiseFloorRMS = max(1e-7, noiseFloorRMS + (rms - noiseFloorRMS) * alpha)
        let threshold = max(minSpeechRMS, noiseFloorRMS * speechBoostFactor)
        if rms >= threshold { lastHeard = Date() }
        let clamped = min(1.0, max(0.0, rms / max(minSpeechRMS, threshold)))
        if let token = overlayToken {
            Task { @MainActor in
                VoiceSessionCoordinator.shared.updateLevel(token: token, clamped)
            }
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

    // MARK: - Restart

    private func restartRecognizer() {
        let current = currentConfig
        stop(dismissOverlay: false, cancelScheduledRestart: false)
        if let current { Task { await start(with: current) } }
    }

    private func restartRecognizerIfIdleAndOverlayHidden() async {
        if isCapturing { return }
        restartRecognizer()
    }

    private func scheduleRestartRecognizer(delay: TimeInterval = 0.7) {
        scheduledRestartTask?.cancel()
        scheduledRestartTask = Task { [weak self] in
            let nanos = UInt64(max(0, delay) * 1_000_000_000)
            try? await Task.sleep(nanoseconds: nanos)
            guard let self else { return }
            await self.consumeScheduledRestart()
            await self.restartRecognizerIfIdleAndOverlayHidden()
        }
    }

    private func consumeScheduledRestart() { scheduledRestartTask = nil }

    // MARK: - Text Utilities

    private func updateHeardBeyondTrigger(withTrimmed trimmed: String) {
        if !heardBeyondTrigger, !trimmed.isEmpty { heardBeyondTrigger = true }
    }

    private static func trimmedAfterTrigger(_ text: String, triggers: [String]) -> String {
        for trigger in triggers {
            let token = trigger.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !token.isEmpty else { continue }
            guard let range = text.range(
                of: token, options: [.caseInsensitive, .diacriticInsensitive, .widthInsensitive])
            else { continue }
            return String(text[range.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return text
    }

    /// Extracts command text after the trigger word, preferring segment-timed
    /// extraction via `WakeWordGate.commandText()` when timing data exists.
    private static func commandAfterTrigger(
        transcript: String,
        segments: [WakeWordSegment],
        triggerEndTime: TimeInterval?,
        triggers: [String]) -> String
    {
        guard let triggerEndTime else {
            return trimmedAfterTrigger(transcript, triggers: triggers)
        }
        let trimmed = WakeWordGate.commandText(
            transcript: transcript, segments: segments, triggerEndTime: triggerEndTime)
        return trimmed.isEmpty ? trimmedAfterTrigger(transcript, triggers: triggers) : trimmed
    }

    // MARK: - Test Helpers

    #if DEBUG
    static func _testTrimmedAfterTrigger(_ text: String, triggers: [String]) -> String {
        trimmedAfterTrigger(text, triggers: triggers)
    }

    static func _testHasContentAfterTrigger(_ text: String, triggers: [String]) -> Bool {
        !trimmedAfterTrigger(text, triggers: triggers).isEmpty
    }

    static func _testAttributedColor(isFinal: Bool) -> NSColor {
        VoiceOverlayTextFormatting.makeAttributed(committed: "sample", volatile: "", isFinal: isFinal)
            .attribute(.foregroundColor, at: 0, effectiveRange: nil) as? NSColor ?? .clear
    }
    #endif
}
