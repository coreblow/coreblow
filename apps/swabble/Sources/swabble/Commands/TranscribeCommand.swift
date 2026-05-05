import AVFoundation; import Commander; import Foundation; import Speech; import Swabble
@MainActor struct TranscribeCommand: ParsableCommand {
    @Argument(help: "Path to audio/video file") var inputFile: String = ""
    @Option(name: .long("locale"), help: "Locale identifier", parsing: .singleValue) var locale: String = Locale.current.identifier
    @Flag(help: "Censor etiquette-sensitive content") var censor: Bool = false
    @Option(name: .long("output"), help: "Output file path") var outputFile: String?
    @Option(name: .long("format"), help: "Output format txt|srt") var format: String = "txt"
    @Option(name: .long("max-length"), help: "Max sentence length for srt") var maxLength: Int = 40
    static var commandDescription: CommandDescription { CommandDescription(commandName: "transcribe", abstract: "Transcribe a media file locally") }
    init() {}
    init(parsed: ParsedValues) { self.init(); if let p = parsed.positional.first { inputFile = p }; if let l = parsed.options["locale"]?.last { locale = l }; if parsed.flags.contains("censor") { censor = true }; if let o = parsed.options["output"]?.last { outputFile = o }; if let f = parsed.options["format"]?.last { format = f }; if let m = parsed.options["maxLength"]?.last, let v = Int(m) { maxLength = v } }
    mutating func run() async throws {
        let fileURL = URL(fileURLWithPath: inputFile)
        let audioFile = try AVAudioFile(forReading: fileURL)
        let outputFmt = OutputFormat(rawValue: format) ?? .txt
        let transcriber = SpeechTranscriber(locale: Locale(identifier: locale), transcriptionOptions: censor ? [.etiquetteReplacements] : [], reportingOptions: [], attributeOptions: outputFmt.needsAudioTimeRange ? [.audioTimeRange] : [])
        let analyzer = SpeechAnalyzer(modules: [transcriber])
        try await analyzer.start(inputAudioFile: audioFile, finishAfterFile: true)
        var transcript: AttributedString = ""
        for try await result in transcriber.results { transcript += result.text }
        let output = outputFmt.text(for: transcript, maxLength: maxLength)
        if let path = outputFile { try output.write(to: URL(fileURLWithPath: path), atomically: false, encoding: .utf8) } else { print(output) }
    }
}
