import AppKit
class CanvasWindow: NSWindow {
    override var canBecomeKey: Bool { true }; override var canBecomeMain: Bool { true }
    convenience init(title: String, size: NSSize) {
        self.init(contentRect: NSRect(origin: .zero, size: size), styleMask: [.titled, .closable, .resizable, .miniaturizable], backing: .buffered, defer: false)
        self.title = title; self.isReleasedWhenClosed = false; self.center()
    }
}
