import SwiftUI
public struct ChatTheme: Sendable { public let userBubbleColor: Color; public let assistantBubbleColor: Color; public let backgroundColor: Color; public let font: Font
    public init(userBubbleColor: Color = .blue.opacity(0.2), assistantBubbleColor: Color = .gray.opacity(0.15), backgroundColor: Color = .clear, font: Font = .body) { self.userBubbleColor = userBubbleColor; self.assistantBubbleColor = assistantBubbleColor; self.backgroundColor = backgroundColor; self.font = font }
    public static let `default` = ChatTheme()
}
