import AppKit
final class HoverHUD { private var panel: NSPanel?; func show(text: String, at point: NSPoint) { dismiss(); let p = NSPanel(contentRect: NSRect(origin: point, size: NSSize(width: 200, height: 40)), styleMask: [.nonactivatingPanel, .hudWindow], backing: .buffered, defer: false); p.isFloatingPanel = true; p.orderFront(nil); panel = p }; func dismiss() { panel?.close(); panel = nil } }
