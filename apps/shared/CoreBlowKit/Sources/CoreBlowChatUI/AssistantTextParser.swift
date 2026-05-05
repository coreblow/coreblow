import Foundation
public enum AssistantTextParser {
    public struct ParsedSegment: Sendable { public enum Kind { case text, code(language: String?), toolCall }; public let kind: Kind; public let content: String }
    public static func parse(_ text: String) -> [ParsedSegment] {
        var segments: [ParsedSegment] = []; var remaining = text
        while let codeStart = remaining.range(of: "```") {
            let before = String(remaining[..<codeStart.lowerBound]); if !before.isEmpty { segments.append(ParsedSegment(kind: .text, content: before)) }
            remaining = String(remaining[codeStart.upperBound...])
            if let codeEnd = remaining.range(of: "```") { let code = String(remaining[..<codeEnd.lowerBound]); segments.append(ParsedSegment(kind: .code(language: nil), content: code)); remaining = String(remaining[codeEnd.upperBound...]) }
            else { segments.append(ParsedSegment(kind: .code(language: nil), content: remaining)); remaining = "" }
        }
        if !remaining.isEmpty { segments.append(ParsedSegment(kind: .text, content: remaining)) }; return segments
    }
}
