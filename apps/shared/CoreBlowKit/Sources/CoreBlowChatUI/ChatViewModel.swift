import Foundation; import Observation
@MainActor @Observable public final class ChatViewModel {
    public var messages: [ChatMessage] = []; public var inputText = ""; public var isLoading = false; public var error: String?
    public init() {}
    public func send() { guard !inputText.isEmpty else { return }; messages.append(ChatMessage(role: .user, content: inputText)); inputText = "" }
    public func receive(_ text: String) { messages.append(ChatMessage(role: .assistant, content: text)) }
    public func clear() { messages.removeAll(); error = nil }
}
