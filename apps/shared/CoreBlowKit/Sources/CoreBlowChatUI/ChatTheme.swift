// CoreBlowChatUI/ChatTheme.swift
// Theming system for the CoreBlow chat interface.

import SwiftUI

/// CoreBlow chat theme configuration.
public struct ChatTheme: Sendable {
    // Colors
    public var primaryColor: Color
    public var backgroundColor: Color
    public var surfaceColor: Color
    public var userBubbleColor: Color
    public var assistantBubbleColor: Color
    public var userTextColor: Color
    public var assistantTextColor: Color
    public var accentColor: Color
    public var errorColor: Color
    public var mutedColor: Color

    // Typography
    public var messageFontSize: CGFloat
    public var timestampFontSize: CGFloat
    public var toolCallFontSize: CGFloat

    // Layout
    public var bubbleCornerRadius: CGFloat
    public var bubblePadding: CGFloat
    public var messageSpacing: CGFloat
    public var composerCornerRadius: CGFloat

    // Animation
    public var streamingCursorBlink: Bool
    public var smoothScrolling: Bool

    /// Default CoreBlow dark theme.
    public static let dark = ChatTheme(
        primaryColor: Color(red: 0.4, green: 0.7, blue: 1.0),
        backgroundColor: Color(red: 0.08, green: 0.08, blue: 0.12),
        surfaceColor: Color(red: 0.12, green: 0.12, blue: 0.16),
        userBubbleColor: Color(red: 0.25, green: 0.45, blue: 0.85),
        assistantBubbleColor: Color(red: 0.15, green: 0.15, blue: 0.2),
        userTextColor: .white,
        assistantTextColor: Color(red: 0.9, green: 0.9, blue: 0.95),
        accentColor: Color(red: 0.5, green: 0.8, blue: 1.0),
        errorColor: Color(red: 1.0, green: 0.4, blue: 0.4),
        mutedColor: Color(red: 0.5, green: 0.5, blue: 0.55),
        messageFontSize: 15,
        timestampFontSize: 11,
        toolCallFontSize: 13,
        bubbleCornerRadius: 16,
        bubblePadding: 12,
        messageSpacing: 8,
        composerCornerRadius: 20,
        streamingCursorBlink: true,
        smoothScrolling: true
    )

    /// Light theme.
    public static let light = ChatTheme(
        primaryColor: Color(red: 0.2, green: 0.4, blue: 0.8),
        backgroundColor: Color(red: 0.97, green: 0.97, blue: 0.98),
        surfaceColor: .white,
        userBubbleColor: Color(red: 0.2, green: 0.5, blue: 0.9),
        assistantBubbleColor: Color(red: 0.94, green: 0.94, blue: 0.96),
        userTextColor: .white,
        assistantTextColor: Color(red: 0.1, green: 0.1, blue: 0.15),
        accentColor: Color(red: 0.2, green: 0.5, blue: 0.9),
        errorColor: Color(red: 0.9, green: 0.2, blue: 0.2),
        mutedColor: Color(red: 0.6, green: 0.6, blue: 0.65),
        messageFontSize: 15,
        timestampFontSize: 11,
        toolCallFontSize: 13,
        bubbleCornerRadius: 16,
        bubblePadding: 12,
        messageSpacing: 8,
        composerCornerRadius: 20,
        streamingCursorBlink: true,
        smoothScrolling: true
    )
}
