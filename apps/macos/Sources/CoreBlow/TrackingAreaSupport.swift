import AppKit
extension NSView { func addFullTrackingArea(owner: AnyObject) { let area = NSTrackingArea(rect: bounds, options: [.mouseEnteredAndExited, .activeInKeyWindow, .inVisibleRect], owner: owner, userInfo: nil); addTrackingArea(area) } }
