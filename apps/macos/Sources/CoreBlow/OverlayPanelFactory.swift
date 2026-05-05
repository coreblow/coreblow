import AppKit
enum OverlayPanelFactory { static func create(size: NSSize, level: NSWindow.Level = .floating) -> NSPanel { let p = NSPanel(contentRect: NSRect(origin: .zero, size: size), styleMask: [.nonactivatingPanel, .hudWindow], backing: .buffered, defer: false); p.isFloatingPanel = true; p.level = level; p.hasShadow = true; return p } }
