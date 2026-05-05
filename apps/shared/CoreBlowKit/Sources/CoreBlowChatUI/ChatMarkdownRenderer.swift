import SwiftUI
public struct ChatMarkdownRenderer: View { let text: String
    public init(_ text: String) { self.text = text }
    public var body: some View { Text(LocalizedStringKey(text)).textSelection(.enabled) }
}
