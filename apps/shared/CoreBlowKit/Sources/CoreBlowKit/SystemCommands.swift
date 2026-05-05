import Foundation
public enum SystemCommands {
    public static func clipboard() -> String? { #if canImport(AppKit); return NSPasteboard.general.string(forType: .string); #else; return UIPasteboard.general.string; #endif }
    public static func setClipboard(_ text: String) { #if canImport(AppKit); NSPasteboard.general.clearContents(); NSPasteboard.general.setString(text, forType: .string); #else; UIPasteboard.general.string = text; #endif }
}
