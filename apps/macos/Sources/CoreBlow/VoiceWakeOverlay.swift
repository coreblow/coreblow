import AppKit
final class VoiceWakeOverlay {
    private var panel: NSPanel?
    func show(text: String) { let p = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 300, height: 60), styleMask: [.nonactivatingPanel, .hudWindow], backing: .buffered, defer: false); p.isFloatingPanel = true; p.level = .floating; p.center(); p.orderFront(nil); panel = p }
    func dismiss() { panel?.close(); panel = nil }
}
