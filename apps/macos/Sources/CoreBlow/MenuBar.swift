import AppKit; import SwiftUI
@MainActor final class MenuBar {
    private var statusItem: NSStatusItem?
    func setup() { statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength); statusItem?.button?.image = NSImage(systemSymbolName: "bolt.fill", accessibilityDescription: "CoreBlow") }
    func updateIcon(connected: Bool) { statusItem?.button?.image = NSImage(systemSymbolName: connected ? "bolt.fill" : "bolt.slash", accessibilityDescription: "CoreBlow") }
}
