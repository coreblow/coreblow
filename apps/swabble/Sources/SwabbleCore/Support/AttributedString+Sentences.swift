import CoreMedia
import Foundation
import NaturalLanguage

extension AttributedString {
    public func sentences(maxLength: Int? = nil) -> [AttributedString] {
        let tokenizer = NLTokenizer(unit: .sentence)
        let raw = String(characters)
        tokenizer.string = raw
        let sentenceRanges = tokenizer.tokens(for: raw.startIndex..<raw.endIndex).map {
            ($0, AttributedString.Index($0.lowerBound, within: self)!..<AttributedString.Index($0.upperBound, within: self)!)
        }
        let ranges = sentenceRanges.flatMap { stringRange, attrRange in
            let sentence = self[attrRange]
            guard let maxLength, sentence.characters.count > maxLength else { return [attrRange] }

            let wordTokenizer = NLTokenizer(unit: .word)
            wordTokenizer.string = raw
            var wordRanges = wordTokenizer.tokens(for: stringRange).map {
                AttributedString.Index($0.lowerBound, within: self)!..<AttributedString.Index($0.upperBound, within: self)!
            }
            guard !wordRanges.isEmpty else { return [attrRange] }
            wordRanges[0] = attrRange.lowerBound..<wordRanges[0].upperBound
            wordRanges[wordRanges.count - 1] = wordRanges[wordRanges.count - 1].lowerBound..<attrRange.upperBound

            var chunks: [Range<AttributedString.Index>] = []
            for wr in wordRanges {
                if let last = chunks.last, self[last].characters.count + self[wr].characters.count <= maxLength {
                    chunks[chunks.count - 1] = last.lowerBound..<wr.upperBound
                } else { chunks.append(wr) }
            }
            return chunks
        }
        return ranges.compactMap { range in
            let timeRanges = self[range].runs.filter { !String(self[$0.range].characters).trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }.compactMap(\.audioTimeRange)
            guard !timeRanges.isEmpty else { return nil }
            var attrs = AttributeContainer()
            attrs[AttributeScopes.SpeechAttributes.TimeRangeAttribute.self] = CMTimeRange(start: timeRanges.first!.start, end: timeRanges.last!.end)
            return AttributedString(self[range].characters, attributes: attrs)
        }
    }
}
