import AppKit
enum WindowPlacement { static func center(_ window: NSWindow) { window.center() }; static func placeNearMenuBar(_ window: NSWindow) { guard let screen = NSScreen.main else { return }; let x = screen.frame.midX - window.frame.width/2; let y = screen.frame.maxY - window.frame.height - 30; window.setFrameOrigin(NSPoint(x: x, y: y)) } }
