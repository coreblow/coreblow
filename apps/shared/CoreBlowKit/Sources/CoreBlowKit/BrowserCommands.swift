import Foundation
public enum BrowserCommands { public static func openURL(_ urlString: String) async -> Bool {
    #if canImport(AppKit); return NSWorkspace.shared.open(URL(string: urlString)!)
    #elseif canImport(UIKit); await UIApplication.shared.open(URL(string: urlString)!); return true
    #else; return false; #endif
} }
