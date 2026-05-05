import CoreMedia
import Foundation

public enum OutputFormat: String {
    case txt, srt
    public var needsAudioTimeRange: Bool { self == .srt }

    public func text(for transcript: AttributedString, maxLength: Int) -> String {
        switch self {
        case .txt: return String(transcript.characters)
        case .srt:
            return transcript.sentences(maxLength: maxLength).compactMap { sentence -> (CMTimeRange, String)? in
                guard let tr = sentence.audioTimeRange else { return nil }
                return (tr, String(sentence.characters))
            }.enumerated().map { idx, run in
                let (tr, text) = run
                return "\n\(idx + 1)\n\(formatSRT(tr.start.seconds)) --> \(formatSRT(tr.end.seconds))\n\(text.trimmingCharacters(in: .whitespacesAndNewlines))\n"
            }.joined().trimmingCharacters(in: .whitespacesAndNewlines)
        }
    }

    private func formatSRT(_ t: TimeInterval) -> String {
        let ms = Int(t.truncatingRemainder(dividingBy: 1) * 1000)
        let s = Int(t) % 60; let m = (Int(t) / 60) % 60; let h = Int(t) / 3600
        return String(format: "%02d:%02d:%02d,%03d", h, m, s, ms)
    }
}
