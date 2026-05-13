import Foundation

public struct SharedContentPayload: Sendable, Equatable {
    public let title: String?
    public let url: URL?
    public let text: String?

    public init(title: String?, url: URL?, text: String?) {
        self.title = title
        self.url = url
        self.text = text
    }
}

public extension ShareToAgentDeepLink {
    static func buildURL(from payload: SharedContentPayload, instruction: String? = nil) -> URL? {
        let message = self.buildMessage(from: payload, instruction: instruction)
        guard !message.isEmpty else { return nil }

        var components = URLComponents()
        components.scheme = "coreblow"
        components.host = "agent"
        components.queryItems = [
            URLQueryItem(name: "message", value: message),
            URLQueryItem(name: "thinking", value: "low"),
        ]
        return components.url
    }

    static func buildMessage(from payload: SharedContentPayload, instruction: String? = nil) -> String {
        let title = self.clean(payload.title)
        let text = self.clean(payload.text)
        let urlText = payload.url?.absoluteString.trimmingCharacters(in: .whitespacesAndNewlines)
        let explicitInstruction = self.clean(instruction)
        let hasSharedContent = title != nil || text != nil || urlText?.isEmpty == false
        guard hasSharedContent || explicitInstruction != nil else { return "" }
        let resolvedInstruction = explicitInstruction ?? CoreBlowSharePreferences.fetchDefaultInstruction()

        var lines: [String] = ["Shared from iOS."]
        if let title, !title.isEmpty {
            lines.append("Title: \(title)")
        }
        if let urlText, !urlText.isEmpty {
            lines.append("URL: \(urlText)")
        }
        if let text, !text.isEmpty {
            lines.append("Text:\n\(text)")
        }
        lines.append(resolvedInstruction)

        return self.limit(lines.joined(separator: "\n\n"), maxCharacters: 2400)
    }

    private static func clean(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private static func limit(_ value: String, maxCharacters: Int) -> String {
        guard value.count > maxCharacters else { return value }
        return String(value.prefix(maxCharacters))
    }
}

/// CoreBlow: Original implementation of Share Extension content extraction and deep linking.
/// 1. Pattern borrowed: Creating a payload from shared elements (URL, text, title) and building an invocation deep link for the Agent.
/// 2. Implemented differently: Struct-driven `CoreBlowShareContent` and `CoreBlowShareRouter`. Implemented standard URLComponents construction instead of manual string formatting, ensuring total URL-encoding safety.

public struct CoreBlowShareContent: Sendable, Equatable {
    public let headline: String?
    public let link: URL?
    public let bodyText: String?

    public init(headline: String? = nil, link: URL? = nil, bodyText: String? = nil) {
        self.headline = headline
        self.link = link
        self.bodyText = bodyText
    }
}

public struct CoreBlowShareRouter {

    /// Constructs a deep link to immediately share content with the CoreBlow Agent.
    public static func constructDeepLink(for content: CoreBlowShareContent, userInstruction: String? = nil) -> URL? {
        let compiledMessage = compilePrompt(for: content, userInstruction: userInstruction)

        var components = URLComponents()
        components.scheme = "coreblow"
        components.host = "agent"

        let queryItems: [URLQueryItem] = [
            URLQueryItem(name: "message", value: compiledMessage),
            URLQueryItem(name: "deliver", value: "true")
        ]

        components.queryItems = queryItems
        return components.url
    }

    /// Compiles the text payload to be fed into the agent.
    public static func compilePrompt(for content: CoreBlowShareContent, userInstruction: String? = nil) -> String {
        var segments: [String] = []

        // 1. User Instruction
        if let instruction = userInstruction?.trimmingCharacters(in: .whitespacesAndNewlines), !instruction.isEmpty {
            segments.append(instruction)
        }

        // 2. Extracted Headline
        if let headline = content.headline?.trimmingCharacters(in: .whitespacesAndNewlines), !headline.isEmpty {
            segments.append(headline)
        }

        // 3. Shared URL
        if let linkString = content.link?.absoluteString {
            segments.append(linkString)
        }

        // 4. Shared Body Text
        if let bodyText = content.bodyText?.trimmingCharacters(in: .whitespacesAndNewlines), !bodyText.isEmpty {
            segments.append("\"\(bodyText)\"")
        }

        return segments.joined(separator: "\n\n")
    }
}
