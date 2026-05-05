import AppKit; import SwiftUI
enum SettingsWindowOpener {
    private static var window: NSWindow?
    static func open() { if let w = window { w.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true); return }
        let w = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 550, height: 400), styleMask: [.titled, .closable, .resizable], backing: .buffered, defer: false)
        w.contentView = NSHostingView(rootView: SettingsRootView()); w.title = "CoreBlow Settings"; w.center(); w.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true); window = w
    }
}
