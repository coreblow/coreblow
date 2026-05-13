import SwiftUI
import CoreBlowKit

#if os(macOS)
import AppKit
#else
import UIKit
#endif

#if os(macOS)
extension NSAppearance {
    fileprivate var isDarkAqua: Bool {
        self.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
    }
}
#endif

/// CoreBlow: Centralized chat UI theme providing semantic colors, backgrounds,
/// and visual tokens that adapt to light/dark appearance modes.
///
/// Follows the same architecture as OC's theme enum — all members are static
/// computed properties so they resolve dynamically against the current appearance.
public enum CoreBlowChatTheme {
    #if os(macOS)
    static func resolvedAssistantBubbleColor(for appearance: NSAppearance) -> NSColor {
        appearance.isDarkAqua
            ? NSColor(calibratedWhite: 0.18, alpha: 0.88)
            : NSColor(calibratedWhite: 0.94, alpha: 0.92)
    }

    static func resolvedOnboardingAssistantBubbleColor(for appearance: NSAppearance) -> NSColor {
        appearance.isDarkAqua
            ? NSColor(calibratedWhite: 0.20, alpha: 0.94)
            : NSColor(calibratedWhite: 0.97, alpha: 0.98)
    }

    static let assistantBubbleDynamicNSColor = NSColor(
        name: NSColor.Name("CoreBlowChatTheme.assistantBubble"),
        dynamicProvider: resolvedAssistantBubbleColor(for:))

    static let onboardingAssistantBubbleDynamicNSColor = NSColor(
        name: NSColor.Name("CoreBlowChatTheme.onboardingAssistantBubble"),
        dynamicProvider: resolvedOnboardingAssistantBubbleColor(for:))
    #endif

    static var surface: Color {
        #if os(macOS)
        Color(nsColor: .windowBackgroundColor)
        #else
        Color(uiColor: .systemBackground)
        #endif
    }

    @ViewBuilder
    static var background: some View {
        #if os(macOS)
        ZStack {
            Rectangle()
                .fill(.ultraThinMaterial)
            LinearGradient(
                colors: [
                    Color.white.opacity(0.12),
                    Color(nsColor: .windowBackgroundColor).opacity(0.35),
                    Color.black.opacity(0.35),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing)
            RadialGradient(
                colors: [
                    Color(nsColor: .systemOrange).opacity(0.14),
                    .clear,
                ],
                center: .topLeading,
                startRadius: 40,
                endRadius: 320)
            RadialGradient(
                colors: [
                    Color(nsColor: .systemTeal).opacity(0.12),
                    .clear,
                ],
                center: .topTrailing,
                startRadius: 40,
                endRadius: 280)
            Color.black.opacity(0.08)
        }
        #else
        Color(uiColor: .systemBackground)
        #endif
    }

    static var card: Color {
        #if os(macOS)
        Color(nsColor: .textBackgroundColor)
        #else
        Color(uiColor: .secondarySystemBackground)
        #endif
    }

    static var subtleCard: AnyShapeStyle {
        #if os(macOS)
        AnyShapeStyle(.ultraThinMaterial)
        #else
        AnyShapeStyle(Color(uiColor: .secondarySystemBackground).opacity(0.9))
        #endif
    }

    static var userBubble: Color {
        Color(red: 127 / 255.0, green: 184 / 255.0, blue: 212 / 255.0)
    }

    static var assistantBubble: Color {
        #if os(macOS)
        Color(nsColor: self.assistantBubbleDynamicNSColor)
        #else
        Color(uiColor: .secondarySystemBackground)
        #endif
    }

    static var onboardingAssistantBubble: Color {
        #if os(macOS)
        Color(nsColor: self.onboardingAssistantBubbleDynamicNSColor)
        #else
        Color(uiColor: .secondarySystemBackground)
        #endif
    }

    static var onboardingAssistantBorder: Color {
        #if os(macOS)
        Color.white.opacity(0.12)
        #else
        Color.white.opacity(0.12)
        #endif
    }

    static var userText: Color { .white }

    static var assistantText: Color {
        #if os(macOS)
        Color(nsColor: .labelColor)
        #else
        Color(uiColor: .label)
        #endif
    }

    static var composerBackground: AnyShapeStyle {
        #if os(macOS)
        AnyShapeStyle(.ultraThinMaterial)
        #else
        AnyShapeStyle(Color(uiColor: .systemBackground))
        #endif
    }

    static var composerField: AnyShapeStyle {
        #if os(macOS)
        AnyShapeStyle(.thinMaterial)
        #else
        AnyShapeStyle(Color(uiColor: .secondarySystemBackground))
        #endif
    }

    static var composerBorder: Color {
        Color.white.opacity(0.12)
    }

    static var divider: Color {
        Color.secondary.opacity(0.2)
    }
}

/// CoreBlow: Cross-platform image factory for SwiftUI rendering.
enum CoreBlowPlatformImageFactory {
    static func image(_ image: CoreBlowPlatformImage) -> Image {
        #if os(macOS)
        Image(nsImage: image)
        #else
        Image(uiImage: image)
        #endif
    }
}

/// Legacy typealias for CoreBlow style system compatibility.
/// New code should reference `CoreBlowChatTheme` directly.
public typealias CoreBlowStyleSystem = CoreBlowChatTheme

public struct CoreBlowImageAssets {
    /// Loads a system icon safely.
    public static func systemIcon(named name: String) -> Image {
        return Image(systemName: name)
    }

    /// Loads a custom branded asset from the module bundle.
    public static func brandAsset(named name: String) -> Image {
        return Image(name, bundle: CoreBlowResources.activeBundle)
    }
}
