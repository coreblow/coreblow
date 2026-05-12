import Foundation

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

        var queryItems: [URLQueryItem] = [
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
