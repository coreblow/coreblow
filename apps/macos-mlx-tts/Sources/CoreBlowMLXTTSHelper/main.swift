import Foundation
import MLXAudioTTS

/// CoreBlow MLX TTS command-line helper.
///
/// Synthesizes speech from text using an MLX audio model and writes the result
/// as a WAV file. This runs out-of-process so the main app stays responsive.
@main
enum CoreBlowMLXTTSHelper {
    static func main() async {
        do {
            let opts = try CLIOptions.parse(Array(CommandLine.arguments.dropFirst()))
            let wavData = try await runSynthesis(opts)
            try wavData.write(to: opts.outputURL, options: [.atomic])
        } catch {
            FileHandle.standardError.write(Data("coreblow-mlx-tts: \(error)\n".utf8))
            exit(1)
        }
    }

    // MARK: - Synthesis

    private static func runSynthesis(_ opts: CLIOptions) async throws -> Data {
        let model = try await TTS.loadModel(modelRepo: opts.modelRepo)
        let wrapper = SendableSpeechModel(model: model)
        let samples = try await wrapper.generate(
            text: opts.text,
            voice: opts.voice,
            language: opts.language)
        return encodeWAV(samples: samples, sampleRate: Double(model.sampleRate))
    }

    // MARK: - CLI Parsing

    struct CLIOptions {
        let text: String
        let modelRepo: String
        let outputURL: URL
        let language: String?
        let voice: String?

        static func parse(_ args: [String]) throws -> CLIOptions {
            var text: String?
            var modelRepo = "mlx-community/Soprano-80M-bf16"
            var outputPath: String?
            var language: String?
            var voice: String?

            var idx = args.startIndex
            while idx < args.endIndex {
                let arg = args[idx]
                switch arg {
                case "--text", "-t":
                    text = try requireNext(args: args, idx: &idx, flag: arg)
                case "--model":
                    modelRepo = try requireNext(args: args, idx: &idx, flag: arg)
                case "--output", "-o":
                    outputPath = try requireNext(args: args, idx: &idx, flag: arg)
                case "--language":
                    language = try requireNext(args: args, idx: &idx, flag: arg)
                case "--voice", "-v":
                    voice = try requireNext(args: args, idx: &idx, flag: arg)
                case "--help", "-h":
                    throw CLIError.helpRequested
                default:
                    if text == nil, !arg.hasPrefix("-") {
                        text = arg
                    } else {
                        throw CLIError.unrecognized("unknown option \(arg)")
                    }
                }
                idx += 1
            }

            guard let resolved = text?.trimmedOrNil else {
                throw CLIError.unrecognized("missing --text")
            }
            guard let out = outputPath, !out.isEmpty else {
                throw CLIError.unrecognized("missing --output")
            }

            return CLIOptions(
                text: resolved,
                modelRepo: modelRepo,
                outputURL: URL(fileURLWithPath: out),
                language: language?.trimmedOrNil,
                voice: voice?.trimmedOrNil)
        }

        // codespell:ignore inout
        private static func requireNext(args: [String], idx: inout Int, flag: String) throws -> String {
            let nextIdx = idx + 1
            guard nextIdx < args.endIndex, !args[nextIdx].isEmpty else {
                throw CLIError.unrecognized("missing value for \(flag)")
            }
            idx = nextIdx
            return args[nextIdx]
        }
    }

    // MARK: - Errors

    enum CLIError: Error, CustomStringConvertible {
        case helpRequested
        case unrecognized(String)

        var description: String {
            let usage = "usage: coreblow-mlx-tts --text <text> --output <wav> [--model <hf-repo>] [--language <id>] [--voice <name>]"
            switch self {
            case .helpRequested:
                return usage
            case .unrecognized(let msg):
                return "\(msg)\n\(usage)"
            }
        }
    }

    // MARK: - WAV Encoding

    /// Encode float PCM samples into a standard 16-bit mono WAV file.
    static func encodeWAV(samples: [Float], sampleRate: Double) -> Data {
        let channelCount: UInt16 = 1
        let bitDepth: UInt16 = 16
        let bytesPerFrame = channelCount * (bitDepth / 8)
        let rate = UInt32(sampleRate.rounded())
        let byteRate = rate * UInt32(bytesPerFrame)
        let pcmByteCount = UInt32(samples.count) * UInt32(bytesPerFrame)

        var wav = Data(capacity: 44 + Int(pcmByteCount))

        // RIFF header
        wav.append(contentsOf: [0x52, 0x49, 0x46, 0x46])
        wav.appendLE(UInt32(36 + pcmByteCount))
        wav.append(contentsOf: [0x57, 0x41, 0x56, 0x45])

        // fmt sub-chunk
        wav.append(contentsOf: [0x66, 0x6D, 0x74, 0x20])
        wav.appendLE(UInt32(16))        // sub-chunk size
        wav.appendLE(UInt16(1))         // PCM format
        wav.appendLE(channelCount)
        wav.appendLE(rate)
        wav.appendLE(byteRate)
        wav.appendLE(bytesPerFrame)
        wav.appendLE(bitDepth)

        // data sub-chunk
        wav.append(contentsOf: [0x64, 0x61, 0x74, 0x61])
        wav.appendLE(pcmByteCount)

        for sample in samples {
            let clamped = min(max(sample, -1.0), 1.0)
            let quantized = Int16((clamped * Float(Int16.max)).rounded())
            wav.appendLE(quantized)
        }

        return wav
    }
}

// MARK: - Sendable Model Wrapper

/// Thread-safe wrapper for the speech generation model.
private struct SendableSpeechModel: @unchecked Sendable {
    let model: any SpeechGenerationModel

    func generate(text: String, voice: String?, language: String?) async throws -> [Float] {
        let audio = try await model.generate(
            text: text,
            voice: voice,
            refAudio: nil,
            refText: nil,
            language: language)
        return audio.asArray(Float.self)
    }
}

// MARK: - Extensions

private extension String {
    var trimmedOrNil: String? {
        let t = trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }
}

private extension Data {
    mutating func appendLE(_ value: UInt16) {
        var le = value.littleEndian
        Swift.withUnsafeBytes(of: &le) { append(contentsOf: $0) }
    }

    mutating func appendLE(_ value: UInt32) {
        var le = value.littleEndian
        Swift.withUnsafeBytes(of: &le) { append(contentsOf: $0) }
    }

    mutating func appendLE(_ value: Int16) {
        var le = value.littleEndian
        Swift.withUnsafeBytes(of: &le) { append(contentsOf: $0) }
    }
}
