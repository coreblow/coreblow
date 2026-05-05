import Foundation
final class MacNodeBrowserProxy {
    func openURL(_ urlString: String) -> Bool {
        guard let url = URL(string: urlString) else { return false }
        #if canImport(AppKit)
        return NSWorkspace.shared.open(url)
        #else
        return false
        #endif
    }
}
