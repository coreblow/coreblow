// CoreBlowChatUI/ChatMarkdownRenderer.swift
// Lightweight Markdown → AttributedString renderer for chat messages.

import SwiftUI

/// Renders basic Markdown to SwiftUI AttributedString.
public enum ChatMarkdownRenderer {

    /// Render a markdown string to AttributedString.
    public static func render(_ markdown: String, fontSize: CGFloat = 15) -> AttributedString {
        // Use Apple's built-in Markdown parser
        guard var result = try? AttributedString(markdown: markdown, options: .init(
            interpretedSyntax: .inlineOnlyPreservingWhitespace
        )) else {
            return AttributedString(markdown)
        }

        // Apply base font
        result.font = .system(size: fontSize)

        return result
    }

    /// Render markdown with full block-level support (paragraphs, code blocks, lists).
    public static func renderFull(_ markdown: String, fontSize: CGFloat = 15) -> AttributedString {
        guard var result = try? AttributedString(markdown: markdown, options: .init(
            interpretedSyntax: .full
        )) else {
            return AttributedString(markdown)
        }

        result.font = .system(size: fontSize)
        return result
    }

    /// Check if a string contains markdown formatting.
    public static func containsMarkdown(_ text: String) -> Bool {
        let patterns = ["```", "**", "__", "~~", "- ", "* ", "# ", "[", "`", "> "]
        return patterns.contains { text.contains($0) }
    }
}
