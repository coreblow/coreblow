import Foundation
public enum ChatMarkdownPreprocessor {
    public static func preprocess(_ text: String) -> String { text.replacingOccurrences(of: "```\n", with: "```swift\n") }
    public static func stripCodeBlocks(_ text: String) -> String { text.replacingOccurrences(of: "```[\\s\\S]*?```", with: "[code block]", options: .regularExpression) }
}
