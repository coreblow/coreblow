// CoreBlowChatUI/ChatMarkdownPreprocessor.swift
// Preprocesses markdown text to extract code blocks and handle special formatting.

import Foundation

/// A code block extracted from markdown text.
public struct CodeBlock: Identifiable, Sendable {
    public let id = UUID()
    public let language: String?
    public let code: String
    public let range: Range<String.Index>

    public init(language: String?, code: String, range: Range<String.Index>) {
        self.language = language; self.code = code; self.range = range
    }
}

/// Preprocesses markdown text for rendering.
public enum ChatMarkdownPreprocessor {

    /// Extract fenced code blocks from markdown text.
    public static func extractCodeBlocks(_ text: String) -> [CodeBlock] {
        var blocks: [CodeBlock] = []
        let pattern = #"```(\w*)\n([\s\S]*?)```"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }

        let nsText = text as NSString
        let matches = regex.matches(in: text, range: NSRange(location: 0, length: nsText.length))

        for match in matches {
            guard match.numberOfRanges >= 3 else { continue }
            let langRange = match.range(at: 1)
            let codeRange = match.range(at: 2)
            let fullRange = match.range(at: 0)

            let language = langRange.length > 0 ? nsText.substring(with: langRange) : nil
            let code = nsText.substring(with: codeRange).trimmingCharacters(in: .newlines)

            guard let swiftFullRange = Range(fullRange, in: text) else { continue }
            blocks.append(CodeBlock(language: language, code: code, range: swiftFullRange))
        }

        return blocks
    }

    /// Split text into segments: plain text and code blocks.
    public static func splitSegments(_ text: String) -> [MarkdownSegment] {
        let codeBlocks = extractCodeBlocks(text)
        guard !codeBlocks.isEmpty else {
            return [.text(text)]
        }

        var segments: [MarkdownSegment] = []
        var cursor = text.startIndex

        for block in codeBlocks {
            if cursor < block.range.lowerBound {
                let plain = String(text[cursor..<block.range.lowerBound])
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                if !plain.isEmpty { segments.append(.text(plain)) }
            }
            segments.append(.codeBlock(language: block.language, code: block.code))
            cursor = block.range.upperBound
        }

        if cursor < text.endIndex {
            let remaining = String(text[cursor...]).trimmingCharacters(in: .whitespacesAndNewlines)
            if !remaining.isEmpty { segments.append(.text(remaining)) }
        }

        return segments
    }

    /// Detect and extract URLs from text.
    public static func extractURLs(_ text: String) -> [URL] {
        guard let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue) else { return [] }
        let matches = detector.matches(in: text, range: NSRange(location: 0, length: (text as NSString).length))
        return matches.compactMap(\.url)
    }
}

/// A segment of preprocessed markdown.
public enum MarkdownSegment: Sendable {
    case text(String)
    case codeBlock(language: String?, code: String)
}
