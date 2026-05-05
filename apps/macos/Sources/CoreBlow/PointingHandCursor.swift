import AppKit
final class PointingHandButton: NSButton { override func resetCursorRects() { addCursorRect(bounds, cursor: .pointingHand) } }
