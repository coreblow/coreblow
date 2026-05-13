import Foundation

// MARK: - Canvas aliases
public typealias CanvasA2UIAction = CoreBlowCanvasAction
public typealias WebViewJavaScriptSupport = CoreBlowWebViewJavaScriptSupport
public typealias TalkConfigParsing = CoreBlowTalkConfigResolver

// MARK: - Chat aliases
// NOTE: ChatViewModel = CoreBlowChatViewModel lives in CoreBlowChatUI,
// not here. CoreBlowKit cannot depend on CoreBlowChatUI.
// Consumers that need ChatViewModel must `import CoreBlowChatUI`.
