import AppKit
import OSLog
import CoreBlowKit
import OSLog
import Foundation
import CoreBlowKit

/// Text formatting helpers for the voice wake overlay.
enum VoiceOverlayTextFormatting {
    /// Parse a transcript into the trigger word prefix and the command suffix.
    static func format(transcript: String, trigger: String) -> (before: String, command: String)? {
        guard let range = transcript.lowercased().range(of: trigger.lowercased()) else { return nil }
        return (
            String(transcript[..<range.lowerBound]),
            String(transcript[range.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
        )
    }

    /// Compute the delta (new text after committed portion).
    static func delta(after committed: String, current: String) -> String {
        if committed.isEmpty { return current }
        guard current.hasPrefix(committed) else { return current }
        return String(current.dropFirst(committed.count))
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Create an attributed string with committed and volatile portions styled differently.
    static func makeAttributed(
        committed: String,
        volatile: String,
        isFinal: Bool,
        fontSize: CGFloat = 18
    ) -> NSAttributedString {
        let result = NSMutableAttributedString()
        let baseFont = NSFont.systemFont(ofSize: fontSize, weight: .medium)
        let committedColor: NSColor = isFinal ? .labelColor : .secondaryLabelColor
        let volatileColor: NSColor = .tertiaryLabelColor

        if !committed.isEmpty {
            let attrs: [NSAttributedString.Key: Any] = [
                .font: baseFont,
                .foregroundColor: committedColor,
            ]
            result.append(NSAttributedString(string: committed, attributes: attrs))
        }

        if !volatile.isEmpty {
            let attrs: [NSAttributedString.Key: Any] = [
                .font: NSFont.systemFont(ofSize: fontSize, weight: .regular),
                .foregroundColor: volatileColor,
            ]
            if !committed.isEmpty {
                result.append(NSAttributedString(string: " ", attributes: attrs))
            }
            result.append(NSAttributedString(string: volatile, attributes: attrs))
        }

        return result
    }

    /// Create an attributed string with the trigger highlighted.
    static func makeAttributed(
        transcript: String,
        trigger: String,
        triggerColor: NSColor = .systemBlue,
        commandColor: NSColor = .labelColor,
        fontSize: CGFloat = 18
    ) -> NSAttributedString {
        let result = NSMutableAttributedString()
        let baseFont = NSFont.systemFont(ofSize: fontSize, weight: .medium)
        let baseAttrs: [NSAttributedString.Key: Any] = [
            .font: baseFont,
            .foregroundColor: commandColor,
        ]

        guard let parsed = format(transcript: transcript, trigger: trigger) else {
            return NSAttributedString(string: transcript, attributes: baseAttrs)
        }

        if !parsed.before.isEmpty {
            result.append(NSAttributedString(string: parsed.before, attributes: baseAttrs))
        }

        let triggerAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: fontSize, weight: .bold),
            .foregroundColor: triggerColor,
        ]
        result.append(NSAttributedString(string: trigger, attributes: triggerAttrs))

        if !parsed.command.isEmpty {
            result.append(NSAttributedString(string: " " + parsed.command, attributes: baseAttrs))
        }

        return result
    }
}
