import Foundation
import SwabbleKit

/// Shared test helper for constructing `WakeWordSegment` arrays from
/// a transcript string and word-timing tuples.
func makeWakeWordSegments(
    transcript: String,
    words: [(String, TimeInterval, TimeInterval)])
-> [WakeWordSegment] {
    var cursor = transcript.startIndex
    return words.map { word, start, duration in
        let range = transcript.range(of: word, range: cursor..<transcript.endIndex)
        if let range {
            cursor = range.upperBound
        }
        return WakeWordSegment(text: word, start: start, duration: duration, range: range)
    }
}
