import Foundation

public enum BrowserCommands {
    public static func openURL(_ urlString: String) async -> Bool {
        guard let url = URL(string: urlString) else { return false }
        #if canImport(AppKit)
        return NSWorkspace.shared.open(url)
        #elseif canImport(UIKit)
        await UIApplication.shared.open(url)
        return true
        #else
        return false
        #endif
    }
}
