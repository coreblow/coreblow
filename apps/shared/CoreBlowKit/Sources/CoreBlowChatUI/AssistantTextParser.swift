// CoreBlowChatUI/AssistantTextParser.swift
// Parses assistant output containing <think> and <final> XML-style tags.

import Foundation

/// A segment of parsed assistant text.
public struct AssistantTextSegment: Identifiable, Sendable {
    public enum Kind: Sendable {
        case thinking
        case response
    }

    public let id = UUID()
    public let kind: Kind
    public let text: String
}

/// Parses assistant output into thinking vs response segments.
///
/// Handles `<think>...</think>` blocks from Claude, DeepSeek, etc.
public enum AssistantTextParser {

    /// Parse raw assistant text into segments.
    public static func segments(from raw: String, includeThinking: Bool = true) -> [AssistantTextSegment] {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }
        guard raw.contains("<") else {
            return [AssistantTextSegment(kind: .response, text: trimmed)]
        }

        var segments: [AssistantTextSegment] = []
        var cursor = raw.startIndex
        var currentKind: AssistantTextSegment.Kind = .response
        var matchedTag = false

        while let match = nextTag(in: raw, from: cursor) {
            matchedTag = true
            if match.range.lowerBound > cursor {
                appendSegment(kind: currentKind, text: raw[cursor..<match.range.lowerBound], to: &segments)
            }

            guard let tagEnd = raw.range(of: ">", range: match.range.upperBound..<raw.endIndex) else {
                cursor = raw.endIndex
                break
            }

            let isSelfClosing = checkSelfClosing(in: raw, tagEnd: tagEnd)
            cursor = tagEnd.upperBound
            if isSelfClosing { continue }

            if match.closing {
                currentKind = .response
            } else {
                currentKind = match.kind == .think ? .thinking : .response
            }
        }

        if cursor < raw.endIndex {
            appendSegment(kind: currentKind, text: raw[cursor..<raw.endIndex], to: &segments)
        }

        guard matchedTag else {
            return [AssistantTextSegment(kind: .response, text: trimmed)]
        }

        return includeThinking ? segments : segments.filter { $0.kind == .response }
    }

    /// Get only visible (non-thinking) segments.
    public static func visibleSegments(from raw: String) -> [AssistantTextSegment] {
        segments(from: raw, includeThinking: false)
    }

    /// Check if the text has any visible content after filtering thinking blocks.
    public static func hasVisibleContent(in raw: String, includeThinking: Bool = false) -> Bool {
        !segments(from: raw, includeThinking: includeThinking).isEmpty
    }

    // MARK: - Private

    private enum TagKind { case think, final }

    private struct TagMatch {
        let kind: TagKind
        let closing: Bool
        let range: Range<String.Index>
    }

    private static func nextTag(in text: String, from start: String.Index) -> TagMatch? {
        [
            findTagStart(tag: "think", closing: false, in: text, from: start).map { TagMatch(kind: .think, closing: false, range: $0) },
            findTagStart(tag: "think", closing: true, in: text, from: start).map { TagMatch(kind: .think, closing: true, range: $0) },
            findTagStart(tag: "final", closing: false, in: text, from: start).map { TagMatch(kind: .final, closing: false, range: $0) },
            findTagStart(tag: "final", closing: true, in: text, from: start).map { TagMatch(kind: .final, closing: true, range: $0) },
        ]
        .compactMap(\.self)
        .min { $0.range.lowerBound < $1.range.lowerBound }
    }

    private static func findTagStart(tag: String, closing: Bool, in text: String, from start: String.Index) -> Range<String.Index>? {
        let token = closing ? "</\(tag)" : "<\(tag)"
        var searchRange = start..<text.endIndex
        while let range = text.range(of: token, options: [.caseInsensitive, .diacriticInsensitive], range: searchRange) {
            let boundaryIndex = range.upperBound
            guard boundaryIndex < text.endIndex else { return range }
            let boundary = text[boundaryIndex]
            if boundary == ">" || boundary.isWhitespace || (!closing && boundary == "/") { return range }
            searchRange = boundaryIndex..<text.endIndex
        }
        return nil
    }

    private static func checkSelfClosing(in text: String, tagEnd: Range<String.Index>) -> Bool {
        var cursor = tagEnd.lowerBound
        while cursor > text.startIndex {
            cursor = text.index(before: cursor)
            let char = text[cursor]
            if char.isWhitespace { continue }
            return char == "/"
        }
        return false
    }

    private static func appendSegment(kind: AssistantTextSegment.Kind, text: Substring, to segments: inout [AssistantTextSegment]) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        segments.append(AssistantTextSegment(kind: kind, text: trimmed))
    }
}
