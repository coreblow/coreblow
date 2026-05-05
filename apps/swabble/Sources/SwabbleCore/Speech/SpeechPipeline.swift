import AVFoundation
import Foundation
import Speech

@available(macOS 26.0, iOS 26.0, *)
public struct SpeechSegment: Sendable {
    public let text: String
    public let isFinal: Bool
}

@available(macOS 26.0, iOS 26.0, *)
public enum SpeechPipelineError: Error {
    case authorizationDenied
    case analyzerFormatUnavailable
    case transcriberUnavailable
}

/// Live microphone → SpeechAnalyzer → SpeechTranscriber pipeline.
@available(macOS 26.0, iOS 26.0, *)
public actor SpeechPipeline {
    private struct BoxedBuffer: @unchecked Sendable { let buffer: AVAudioPCMBuffer }

    private var engine = AVAudioEngine()
    private var transcriber: SpeechTranscriber?
    private var analyzer: SpeechAnalyzer?
    private var inputContinuation: AsyncStream<AnalyzerInput>.Continuation?
    private var resultTask: Task<Void, Never>?
    private let converter = BufferConverter()

    public init() {}

    public func start(localeIdentifier: String, etiquette: Bool) async throws -> AsyncStream<SpeechSegment> {
        let auth = await requestAuth()
        guard auth == .authorized else { throw SpeechPipelineError.authorizationDenied }

        let module = SpeechTranscriber(
            locale: Locale(identifier: localeIdentifier),
            transcriptionOptions: etiquette ? [.etiquetteReplacements] : [],
            reportingOptions: [.volatileResults],
            attributeOptions: [])
        transcriber = module

        guard let targetFormat = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [module])
        else { throw SpeechPipelineError.analyzerFormatUnavailable }

        analyzer = SpeechAnalyzer(modules: [module])
        let (stream, continuation) = AsyncStream<AnalyzerInput>.makeStream()
        inputContinuation = continuation

        let inputNode = engine.inputNode
        let hwFormat = inputNode.outputFormat(forBus: 0)
        inputNode.removeTap(onBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 2048, format: hwFormat) { [weak self] buf, _ in
            guard let self else { return }
            let boxed = BoxedBuffer(buffer: buf)
            Task { await self.handleBuffer(boxed.buffer, target: targetFormat) }
        }

        engine.prepare()
        try engine.start()
        try await analyzer?.start(inputSequence: stream)

        guard let activeTranscriber = transcriber
        else { throw SpeechPipelineError.transcriberUnavailable }

        return AsyncStream { cont in
            self.resultTask = Task {
                do {
                    for try await result in activeTranscriber.results {
                        cont.yield(SpeechSegment(text: String(result.text.characters), isFinal: result.isFinal))
                    }
                } catch { /* stream ended */ }
                cont.finish()
            }
            cont.onTermination = { _ in Task { await self.stop() } }
        }
    }

    public func stop() async {
        resultTask?.cancel()
        inputContinuation?.finish()
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        try? await analyzer?.finalizeAndFinishThroughEndOfInput()
    }

    private func handleBuffer(_ buffer: AVAudioPCMBuffer, target: AVAudioFormat) async {
        guard let converted = try? converter.convert(buffer, to: target) else { return }
        inputContinuation?.yield(AnalyzerInput(buffer: converted))
    }

    private func requestAuth() async -> SFSpeechRecognizerAuthorizationStatus {
        let current = SFSpeechRecognizer.authorizationStatus()
        guard current == .notDetermined else { return current }
        return await withCheckedContinuation { cont in
            SFSpeechRecognizer.requestAuthorization { cont.resume(returning: $0) }
        }
    }
}
