import Foundation

// MARK: - ChatTheme aliases
// CoreBlowChatTheme is the canonical theme enum (defined in ChatTheme.swift).
// CoreBlowStyleSystem is a legacy typealias pointing to CoreBlowChatTheme.

// MARK: - AssistantTextParser aliases
typealias AssistantTextParser = CoreBlowMessageSegmenter
typealias AssistantTextSegment = CognitiveSegment

// MARK: - Payload aliases
// ChatPayloadDecoding typealias is defined in ChatPayloadDecoding.swift.

// MARK: - Tool Result Formatting aliases
typealias ToolResultTextFormatter = CoreBlowToolResultFormatter
